"""Pipeline entry point.

    python -m pipeline.run
    python -m pipeline.run --offline          # tier 1 only, no network
    python -m pipeline.run --horizon-days 30   # wider window than the default 7
    python -m pipeline.run --dry-run

Runs every adapter, reconciles duplicates, scores confidence, and writes:

    public/data/phenomena.json    what the app reads
    public/data/live_events.geojson  compatibility feed for the existing loader
    pipeline/out/review_queue.json   entries needing a human
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import timedelta
from pathlib import Path
from typing import Any, Callable

from . import SCHEMA_VERSION, publish_gate
from .confidence import apply as apply_confidence, band, reconcile
from .schema import PhenomenonEvent, iso, utcnow
from .sources import citizen, curated, deterministic, model_feeds

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = ROOT / "public" / "data"
OUT_DIR = ROOT / "pipeline" / "out"

log = logging.getLogger("pipeline")

# Default publishing horizon.
#
# Seven days, because this feed answers "what is happening now" and nothing
# else. The catalogue already handles planning — it holds every event with a
# real date, sorted by how soon you must act — so a live feed reaching 120
# days out was duplicating that badly: hundreds of entries, most of them
# months away, in a view whose whole claim is immediacy.
#
# It also matches what the UI already did with them. bucketFor() in
# utils/eventFormat calls anything beyond seven days "On the horizon", a
# section readers had no reason to open in a tab called Live.
DEFAULT_HORIZON_DAYS = 7


def _configure_logging(verbose: bool) -> None:
    # Windows consoles default to a codepage that cannot render the emoji in
    # event names, and a logging call should never take the run down.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def collect(offline: bool) -> list[PhenomenonEvent]:
    """Run every adapter. One failing source must not sink the run."""
    adapters: list[tuple[str, Callable[[], list[PhenomenonEvent]]]] = [
        ("tier1-deterministic", deterministic.fetch),
    ]
    if not offline:
        adapters += [
            ("tier2-model-feeds", model_feeds.fetch),
            ("tier3-citizen", citizen.fetch),
        ]
    adapters.append(("tier4-curated", curated.fetch))

    collected: list[PhenomenonEvent] = []
    for name, adapter in adapters:
        try:
            events = adapter()
            log.info("%-20s %3d events", name, len(events))
            collected.extend(events)
        except Exception:
            log.exception("%-20s FAILED — continuing without it", name)
    return collected


def to_geojson(events: list[PhenomenonEvent]) -> dict[str, Any]:
    """Compatibility feed matching what utils/gdeltService.ts already parses."""
    now = utcnow()
    features = []
    for ev in events:
        lat, lon = ev.published_coords()
        features.append(
            {
                "type": "Feature",
                "id": ev.id,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": ev.name,
                    "emoji": ev.emoji,
                    "category": ev.category.value,
                    "categoryLabel": ev.category.value,
                    "description": ev.description,
                    "locationHint": ev.location_hint,
                    "geocodedAddress": ev.country,
                    "sourceUrl": ev.sources[0].url if ev.sources else "",
                    "startUtc": iso(ev.window_start),
                    "endUtc": iso(ev.window_end),
                    "confidence": round(ev.confidence, 3),
                    "isWithinLiveWindow": ev.is_active(now),
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def to_payload(events: list[PhenomenonEvent], horizon_days: int) -> dict[str, Any]:
    now = utcnow()
    by_tier: dict[int, int] = {}
    for ev in events:
        by_tier[int(ev.tier)] = by_tier.get(int(ev.tier), 0) + 1

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": iso(now),
        "horizonDays": horizon_days,
        "counts": {
            "total": len(events),
            "active": sum(1 for e in events if e.is_active(now)),
            "byTier": {str(k): v for k, v in sorted(by_tier.items())},
            "byBand": {
                name: sum(1 for e in events if band(e.confidence) == name)
                for name in ("high", "medium", "low", "speculative")
            },
        },
        "events": [ev.to_dict() for ev in events],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the Kairosphere phenomena feed")
    parser.add_argument("--offline", action="store_true", help="tier 1 and 4 only, no network")
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS)
    parser.add_argument("--dry-run", action="store_true", help="print a summary, write nothing")
    parser.add_argument(
        "--force",
        action="store_true",
        help="publish even if the run looks like a regression (see publish_gate)",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    _configure_logging(args.verbose)
    started = utcnow()

    events = collect(args.offline)
    log.info("collected %d raw events", len(events))

    events = reconcile(events)
    log.info("%d after reconciliation", len(events))

    now = utcnow()
    events = [e for e in events if e.publishable and e.is_within(now, args.horizon_days)]
    log.info("%d within %d-day horizon", len(events), args.horizon_days)

    events = apply_confidence(events, now)
    events.sort(key=lambda e: (e.window_start, -e.confidence))

    payload = to_payload(events, args.horizon_days)
    queue = curated.review_queue()

    log.info(
        "bands: %s | tiers: %s | review queue: %d",
        payload["counts"]["byBand"],
        payload["counts"]["byTier"],
        len(queue),
    )

    if args.dry_run:
        for ev in events:
            log.info(
                "  %s..%s +/-%.0fd conf %.2f [%s] %s",
                ev.window_start.date(),
                ev.window_end.date(),
                ev.uncertainty_days,
                ev.confidence,
                band(ev.confidence),
                ev.name,
            )
        log.info("dry run — nothing written")
        return 0

    # Compare against what is already published before overwriting it.
    feed_path = PUBLIC_DATA / "phenomena.json"
    previous = None
    if feed_path.exists():
        try:
            previous = json.loads(feed_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("could not read the existing feed for comparison: %s", exc)

    gate = publish_gate.check(payload, previous)
    if not gate.ok:
        for reason in gate.reasons:
            log.error("publish gate: %s", reason)
        if not args.force:
            log.error(
                "refusing to publish (%s). The previous feed is left in place. "
                "Re-run with --force to override.",
                gate.summary,
            )
            return 1
        log.warning("--force given; publishing anyway despite the gate")
    else:
        log.info("publish gate passed: %s", gate.summary)

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    (PUBLIC_DATA / "phenomena.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (PUBLIC_DATA / "live_events.geojson").write_text(
        json.dumps(to_geojson(events), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "review_queue.json").write_text(
        json.dumps(
            {"generatedAt": iso(now), "count": len(queue), "items": queue},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    elapsed = (utcnow() - started).total_seconds()
    log.info(
        "wrote %d events to public/data/phenomena.json in %.1fs",
        len(events),
        elapsed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
