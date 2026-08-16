"""Tier 4 — human-verified entries, and the gate that keeps them honest.

These are the events no feed will ever carry: dates set by elders around a
harvest, gatherings that move with the herds. The automation here is not
prediction, it is bookkeeping —

  * a human confirms a date and signs it with lastVerifiedAt
  * confidence decays from that signature, so neglect makes an entry fade
    rather than sit on the map looking authoritative
  * anything faded, expired, or missing consent lands in a review queue

Two hard rules, enforced in code rather than in a style guide:
sacred entries never publish, and restricted entries never publish a precise
coordinate.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from ..schema import (
    Category,
    PhenomenonEvent,
    Precision,
    Sensitivity,
    SourceKind,
    SourceRef,
    Tier,
    stable_id,
    utcnow,
)

log = logging.getLogger(__name__)

REGISTRY = Path(__file__).resolve().parent.parent / "registry"

# A curated date older than this needs a human to look at it again.
STALE_AFTER_DAYS = 400
# Publish an upcoming entry once it is within this horizon.
LOOKAHEAD_DAYS = 120
# Flag a stale entry this far ahead of its window, so a human can re-confirm
# the date before it is on the map rather than after.
REVIEW_LEAD_DAYS = 150


def _load() -> list[dict[str, Any]]:
    path = REGISTRY / "curated_events.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["events"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        log.warning("curated registry unreadable: %s", exc)
        return []


def _resolve_window(rule: dict[str, Any], today: date) -> Optional[tuple[datetime, datetime]]:
    """Turn a recurrence rule into this season's concrete window."""
    to_dt = lambda d: datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    kind = rule.get("type")

    if kind == "explicit":
        best: Optional[tuple[datetime, datetime]] = None
        for entry in rule.get("windows", []):
            try:
                start = date.fromisoformat(entry["start"])
                end = date.fromisoformat(entry["end"])
            except (KeyError, ValueError):
                continue
            if end < today:
                continue
            if best is None or start < best[0].date():
                best = (to_dt(start), to_dt(end))
        return best

    if kind == "fixed":
        month, day = int(rule["month"]), int(rule["day"])
        duration = int(rule.get("durationDays", 1))
        for year in (today.year, today.year + 1):
            try:
                start = date(year, month, day)
            except ValueError:  # 29 Feb in a common year
                continue
            end = start + timedelta(days=duration)
            if end >= today:
                return to_dt(start), to_dt(end)
        return None

    if kind == "month_window":
        for year in (today.year, today.year + 1):
            try:
                start = date(year, int(rule["startMonth"]), int(rule["startDay"]))
                end_year = year if int(rule["endMonth"]) >= int(rule["startMonth"]) else year + 1
                end = date(end_year, int(rule["endMonth"]), int(rule["endDay"]))
            except (KeyError, ValueError):
                return None
            if end >= today:
                return to_dt(start), to_dt(end)
        return None

    log.warning("unknown recurrence type: %s", kind)
    return None


def _parse_verified(raw: str) -> datetime:
    try:
        return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        # No usable signature means maximally stale, not silently fresh.
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


def review_queue(entries: Optional[list[dict[str, Any]]] = None) -> list[dict[str, Any]]:
    """Entries a human needs to look at, with the reason why."""
    entries = entries if entries is not None else _load()
    today = utcnow().date()
    now = utcnow()
    queue: list[dict[str, Any]] = []

    for entry in entries:
        reasons: list[str] = []
        verified = _parse_verified(entry.get("lastVerifiedAt", ""))
        age_days = (now - verified).days

        if entry.get("reviewStatus") == "pending_review":
            reasons.append("awaiting first review")
        if age_days > STALE_AFTER_DAYS:
            reasons.append(f"unverified for {age_days} days")
        if entry.get("sensitivity") in ("restricted", "sacred") and not entry.get("consent"):
            reasons.append("access-controlled with no consent recorded")

        window = _resolve_window(entry.get("recurrence", {}), today)
        if window is None:
            reasons.append("recurrence rule produced no upcoming window")
        elif window[0] < now < window[1] and age_days > 180:
            reasons.append("window is open but the date was never re-confirmed this season")
        elif window[0] > now and age_days > 180:
            # Catch it before it goes live, not after it has been wrong in public.
            days_out = (window[0] - now).days
            if days_out <= REVIEW_LEAD_DAYS:
                reasons.append(
                    f"opens in {days_out} days on a date last confirmed {age_days} days ago"
                )

        if reasons:
            queue.append(
                {
                    "id": entry.get("id"),
                    "name": entry.get("name"),
                    "country": entry.get("country"),
                    "reviewStatus": entry.get("reviewStatus"),
                    "lastVerifiedAt": entry.get("lastVerifiedAt"),
                    "ageDays": age_days,
                    "reasons": reasons,
                    "operatorSignals": entry.get("operatorSignals", []),
                }
            )

    return sorted(queue, key=lambda item: -item["ageDays"])


def fetch() -> list[PhenomenonEvent]:
    entries = _load()
    today = utcnow().date()
    now = utcnow()
    events: list[PhenomenonEvent] = []

    for entry in entries:
        sensitivity = Sensitivity(entry.get("sensitivity", "public"))

        # Hard stop. Not a filter further down the chain, not a UI toggle.
        if sensitivity is Sensitivity.SACRED:
            log.info("curated %s: withheld (sacred)", entry["id"])
            continue

        if entry.get("reviewStatus") != "published":
            log.info("curated %s: not published (%s)", entry["id"], entry.get("reviewStatus"))
            continue

        window = _resolve_window(entry.get("recurrence", {}), today)
        if window is None:
            log.warning("curated %s: no resolvable window", entry["id"])
            continue

        start, end = window
        if start > now + timedelta(days=LOOKAHEAD_DAYS):
            log.info("curated %s: beyond horizon (opens %s)", entry["id"], start.date())
            continue

        verified = _parse_verified(entry.get("lastVerifiedAt", ""))
        precision = Precision(entry.get("precision", "point"))

        # An access-controlled event never gets a point coordinate, whatever
        # the registry says.
        if sensitivity is Sensitivity.RESTRICTED and precision is Precision.POINT:
            precision = Precision.REGIONAL

        window_days = max(1.0, (end - start).total_seconds() / 86400.0)
        # A month-long "sometime in September" is a weaker claim than a
        # ticketed three-day festival, and should read as one.
        uncertainty = min(20.0, window_days / 3.0)

        sources = [
            SourceRef(
                name=src.get("name", "curated"),
                url=src.get("url", ""),
                kind=SourceKind.CURATED,
                retrieved_at=verified,
                note=entry.get("consent", ""),
            )
            for src in entry.get("sources", [])
        ] or [
            SourceRef(
                name="Kairosphere editorial",
                url="pipeline/registry/curated_events.json",
                kind=SourceKind.CURATED,
                retrieved_at=verified,
            )
        ]

        description = entry["description"]
        if notes := entry.get("notes"):
            description = f"{description} {notes}"

        events.append(
            PhenomenonEvent(
                id=stable_id("curated", entry["id"], start.date().isoformat()),
                name=entry["name"],
                description=description,
                category=Category(entry["category"]),
                tier=Tier.CURATED,
                lat=float(entry["lat"]),
                lon=float(entry["lon"]),
                location_hint=entry["locationHint"],
                country=entry["country"],
                window_start=start,
                window_end=end,
                peak=None,
                uncertainty_days=uncertainty,
                base_confidence=0.85,
                sources=sources,
                last_verified_at=verified,
                emoji=entry.get("emoji", "🎭"),
                sensitivity=sensitivity,
                precision=precision,
                consent=entry.get("consent", ""),
                recurrence=entry.get("recurrence", {}).get("type", ""),
            )
        )

    return events
