"""Tier 3 — citizen-science nowcasting via iNaturalist.

Access is the easy part; inference is the work. A raw observation count says
nothing on its own, so each watch is scored against its own seasonal
distribution:

  1. pull the all-years week-of-year histogram for that taxon in that region
  2. derive the typical window — the weeks holding the bulk of observations
  3. count what has come in recently
  4. express the result as a phase ("62% into the typical window"), never as a
     binary "happening / not happening"

Coordinates stay regional. A cluster of sightings locates a phenomenon to a
landscape, not to a point.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from ..http import get_json
from ..schema import (
    Category,
    PhenomenonEvent,
    Precision,
    SourceKind,
    SourceRef,
    Tier,
    stable_id,
    utcnow,
)

log = logging.getLogger(__name__)

REGISTRY = Path(__file__).resolve().parent.parent / "registry"
API = "https://api.inaturalist.org/v1"

# A week must hold at least this share of the peak week to count as in-season.
IN_SEASON_SHARE = 0.25
# Only publish when the window is current or within this many days of opening.
LOOKAHEAD_DAYS = 45
# Below this many recent observations the signal is noise, not a nowcast.
MIN_RECENT_OBSERVATIONS = 3
RECENT_WINDOW_DAYS = 14


def _load_watches() -> list[dict[str, Any]]:
    path = REGISTRY / "citizen_watch.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["watches"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        log.warning("citizen watch registry unreadable: %s", exc)
        return []


def _resolve_taxon(name: str, rank: str) -> Optional[int]:
    payload = get_json(f"{API}/taxa", params={"q": name, "rank": rank, "per_page": 1})
    results = (payload or {}).get("results") or []
    return results[0]["id"] if results else None


def _histogram(taxon_id: int, watch: dict[str, Any]) -> dict[int, int]:
    payload = get_json(
        f"{API}/observations/histogram",
        params={
            "taxon_id": taxon_id,
            "date_field": "observed",
            "interval": "week_of_year",
            "quality_grade": "research",
            "lat": watch["lat"],
            "lng": watch["lon"],
            "radius": watch["radiusKm"],
        },
        timeout=45,
    )
    weeks = ((payload or {}).get("results") or {}).get("week_of_year") or {}
    return {int(k): int(v) for k, v in weeks.items()}


def _recent_count(taxon_id: int, watch: dict[str, Any], days: int) -> int:
    since = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    payload = get_json(
        f"{API}/observations",
        params={
            "taxon_id": taxon_id,
            "d1": since,
            "lat": watch["lat"],
            "lng": watch["lon"],
            "radius": watch["radiusKm"],
            "per_page": 1,
        },
        timeout=45,
    )
    return int((payload or {}).get("total_results") or 0)


def typical_window(counts: dict[int, int]) -> Optional[tuple[int, int, int]]:
    """Weeks (start, end, peak) holding the season, walking out from the peak.

    Walks outward rather than filtering, so a season spanning the new year
    (weeks 50-3) stays contiguous instead of splitting in two.
    """
    if not counts or max(counts.values(), default=0) == 0:
        return None

    peak_week = max(counts, key=lambda w: counts[w])
    threshold = counts[peak_week] * IN_SEASON_SHARE

    start = end = peak_week
    for step in range(1, 27):
        week = ((peak_week - step - 1) % 53) + 1
        if counts.get(week, 0) >= threshold:
            start = week
        else:
            break
    for step in range(1, 27):
        week = ((peak_week + step - 1) % 53) + 1
        if counts.get(week, 0) >= threshold:
            end = week
        else:
            break
    return start, end, peak_week


def _week_to_date(year: int, week: int) -> date:
    return date(year, 1, 1) + timedelta(days=(max(1, min(53, week)) - 1) * 7)


def _window_dates(start_week: int, end_week: int, today: date) -> tuple[datetime, datetime]:
    """Project week numbers onto concrete dates around today."""
    year = today.year
    start = _week_to_date(year, start_week)
    end = _week_to_date(year, end_week)
    if end < start:  # season wraps the new year
        end = _week_to_date(year + 1, end_week)

    # If this year's window already closed, look to next year's.
    if end < today - timedelta(days=3):
        start = _week_to_date(year + 1, start_week)
        end = _week_to_date(year + 1, end_week)
        if end < start:
            end = _week_to_date(year + 2, end_week)

    to_dt = lambda d: datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return to_dt(start), to_dt(end)


def _phase_text(now: datetime, start: datetime, end: datetime, recent: int) -> str:
    span = (end - start).total_seconds()
    if now < start:
        days = (start - now).days
        return f"Season opens in about {days} days; {recent} reports in the last two weeks."
    if now > end:
        return f"Season closing; {recent} reports in the last two weeks."
    pct = round((now - start).total_seconds() / span * 100) if span else 0
    return (
        f"Underway — roughly {pct}% through the typical window, "
        f"with {recent} reports in the last two weeks."
    )


def fetch() -> list[PhenomenonEvent]:
    watches = _load_watches()
    now = utcnow()
    today = now.date()
    events: list[PhenomenonEvent] = []

    for watch in watches:
        taxon_id = watch.get("taxonId") or _resolve_taxon(watch["taxonName"], watch["taxonRank"])
        if not taxon_id:
            log.warning("citizen %s: could not resolve taxon", watch["id"])
            continue

        counts = _histogram(taxon_id, watch)
        window = typical_window(counts)
        if not window:
            log.info("citizen %s: no seasonal signal in region", watch["id"])
            continue

        start_week, end_week, peak_week = window
        start, end = _window_dates(start_week, end_week, today)

        if start > now + timedelta(days=LOOKAHEAD_DAYS):
            log.info("citizen %s: out of season (opens %s)", watch["id"], start.date())
            continue

        recent = _recent_count(taxon_id, watch, RECENT_WINDOW_DAYS)
        in_window = start <= now <= end
        if in_window and recent < MIN_RECENT_OBSERVATIONS:
            log.info("citizen %s: in window but only %d reports", watch["id"], recent)

        season_total = sum(counts.values())
        window_days = max(1.0, (end - start).total_seconds() / 86400.0)

        # Density of evidence drives confidence; a broad window costs via the
        # uncertainty band rather than being hidden.
        density = min(0.45, 0.10 * (recent ** 0.5))
        history = min(0.20, season_total / 20000.0)
        base = 0.25 + density + history
        if not in_window:
            base *= 0.7

        events.append(
            PhenomenonEvent(
                id=stable_id("citizen", watch["id"], start.date().isoformat()),
                name=watch["name"],
                description=(
                    f"{watch['blurb']} {_phase_text(now, start, end, recent)}"
                ),
                category=Category(watch["category"]),
                tier=Tier.CITIZEN,
                lat=watch["lat"],
                lon=watch["lon"],
                location_hint=watch["locationHint"],
                country=watch["country"],
                window_start=start,
                window_end=end,
                peak=_datetime_for_week(peak_week, start),
                # Half the spread of the observed season, capped.
                uncertainty_days=min(21.0, window_days / 4.0),
                base_confidence=min(0.85, base),
                sources=[
                    SourceRef(
                        name="iNaturalist observations",
                        url=f"{API}/observations?taxon_id={taxon_id}",
                        kind=SourceKind.CITIZEN,
                        retrieved_at=now,
                        note=(
                            f"{season_total} research-grade records in region; "
                            f"peak week {peak_week}; {recent} in last "
                            f"{RECENT_WINDOW_DAYS} days."
                        ),
                    )
                ],
                last_verified_at=now,
                emoji=watch.get("emoji", "🐾"),
                precision=Precision.REGIONAL,
                recurrence="annual, observed",
            )
        )

    return events


def _datetime_for_week(week: int, near: datetime) -> datetime:
    """Peak week resolved into the same season as the window start."""
    candidate = _week_to_date(near.year, week)
    peak = datetime(candidate.year, candidate.month, candidate.day, tzinfo=timezone.utc)
    if peak < near:
        candidate = _week_to_date(near.year + 1, week)
        peak = datetime(candidate.year, candidate.month, candidate.day, tzinfo=timezone.utc)
    return peak
