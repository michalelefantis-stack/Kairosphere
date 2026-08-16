"""Build the per-country local-news feeds.

    python -m pipeline.monitor                # every locale due a refresh
    python -m pipeline.monitor --tier a       # just the frequent ones
    python -m pipeline.monitor --country ID JP
    python -m pipeline.monitor --dry-run

Writes public/data/local/<CC>.json, one file per country.

That shape is deliberate. The client works out which country it is in locally,
from bundled boundaries, and fetches only that one file — so the server never
learns where anybody is standing. For an app whose pitch is "what is happening
near me right now", the difference between that and posting coordinates to a
server is the difference between a feature and a tracking product. It is also
cacheable, cheap to serve, and survives a bad connection.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .sources import local_news as ln

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data" / "local"
STATE = ROOT / "pipeline" / "out" / "monitor_state.json"

log = logging.getLogger("monitor")


def _load_state() -> dict:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _is_due(country: str, tier: str, state: dict, now: datetime) -> bool:
    last = state.get(country)
    if not last:
        return True
    try:
        when = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except ValueError:
        return True
    return now - when >= timedelta(hours=ln.TIER_HOURS.get(tier, 24))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", nargs="*", help="ISO codes to refresh")
    parser.add_argument("--tier", choices=["a", "b", "c"], help="only this tier")
    parser.add_argument("--all", action="store_true", help="ignore refresh schedule")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )

    now = datetime.now(timezone.utc)
    filtered = ln.extraction_available()
    if not filtered:
        log.warning(
            "GEMINI_API_KEY not set — feeds will be marked 'unfiltered' and the "
            "client will not display them"
        )
    state = _load_state()
    locales = ln.load_locales()

    if args.country:
        wanted = {c.upper() for c in args.country}
        locales = [l for l in locales if l["country"] in wanted]
    if args.tier:
        locales = [l for l in locales if l["tier"] == args.tier]
    if not (args.all or args.country):
        locales = [l for l in locales if _is_due(l["country"], l["tier"], state, now)]

    if not locales:
        log.info("nothing due")
        return 0

    log.info("refreshing %d locale(s)", len(locales))
    totals = {"raw": 0, "published": 0, "withheld_private": 0, "dropped_noise": 0}

    for locale in locales:
        raw = ln.collect(locale)
        classified = ln.classify(raw)
        keep = ln.publishable(classified)

        totals["raw"] += len(raw)
        totals["published"] += len(keep)
        totals["withheld_private"] += sum(1 for c in classified if c.is_public is False)
        totals["dropped_noise"] += sum(1 for c in classified if c.kind == "none")

        log.info(
            "%-4s %-16s %3d found -> %3d published",
            locale["country"], locale["name"], len(raw), len(keep)
        )

        if args.dry_run:
            for c in keep[:5]:
                log.info("        %.2f  %s", c.confidence, c.title[:78])
            continue

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "country": locale["country"],
            "name": locale["name"],
            "generatedAt": now.isoformat().replace("+00:00", "Z"),
            "refreshHours": ln.TIER_HOURS.get(locale["tier"], 24),
            # Everything in here is an unconfirmed report, and the client is
            # expected to say so rather than render it like a curated event.
            # Without the classifier nothing has been filtered for relevance
            # or for private-vs-public, so the client must refuse to show it.
            "status": "unconfirmed" if filtered else "unfiltered",
            "count": len(keep),
            "reports": [c.to_dict() for c in keep],
        }
        (OUT_DIR / f"{locale['country']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        state[locale["country"]] = now.isoformat().replace("+00:00", "Z")

    if not args.dry_run:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, indent=2), encoding="utf-8")

        index = {
            "generatedAt": now.isoformat().replace("+00:00", "Z"),
            "countries": sorted(
                p.stem for p in OUT_DIR.glob("*.json") if p.stem != "index"
            ),
        }
        (OUT_DIR / "index.json").write_text(
            json.dumps(index, indent=2), encoding="utf-8"
        )

    log.info(
        "%d found, %d published, %d withheld as private, %d dropped as noise",
        totals["raw"], totals["published"],
        totals["withheld_private"], totals["dropped_noise"],
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
