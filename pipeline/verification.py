"""Verifying a report without users.

Crowd confirmation is the right long-term answer and the wrong launch answer:
it needs an audience that does not exist yet. Until then the system has to do
its own checking, from four signals that cost nothing:

  geocoding      does the place named actually exist, in the right country?
                 Also the only way a report can reach the map at all.
  computation    does a claimed temple ceremony coincide with a pawukon window,
                 or a catalogue event we already hold? Tier 1 verifying Tier 4.
  publisher      is this an outlet that files constantly, or a blog seen once?
                 The list builds itself from observed frequency.
  corroboration  how many independent outlets carry it, accumulated across
                 queries and across runs.

Corroboration is deliberately last. Measured on live Indonesian news, only 3
stories in 97 were carried by more than one outlet inside a single query — it
is a real signal but a thin one, and leaning on it would have been a mistake.

Every signal writes a sentence into `reasons`, which the UI shows. A number
the reader cannot interrogate is not verification, it is decoration.
"""

from __future__ import annotations

import json
import logging
import time
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import requests

log = logging.getLogger(__name__)

OUT = Path(__file__).resolve().parent / "out"
GEOCACHE = OUT / "geocache.json"
PUBLISHERS = OUT / "publishers.json"
SEEN = OUT / "seen_reports.json"

NOMINATIM = "https://nominatim.openstreetmap.org/search"
# Nominatim's policy is one request a second with a real User-Agent. Results
# are cached permanently — place names do not move.
NOMINATIM_UA = "kairosphere-monitor/1.0 (+https://kairosphere.app)"
_last_call = 0.0


def _load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ── geocoding ─────────────────────────────────────────────────────────────

def geocode(place: str, country: str, cache: dict | None = None) -> dict | None:
    """Resolve a place name inside a country to coordinates.

    Two jobs at once: a name that cannot be found is a sign the extraction
    hallucinated it, and a name that can be found is what lets the report sit
    on the map instead of only in a list.
    """
    if not place:
        return None
    cache = cache if cache is not None else _load(GEOCACHE, {})
    key = f"{country}:{place.lower()}"
    if key in cache:
        return cache[key]

    global _last_call
    wait = 1.05 - (time.time() - _last_call)
    if wait > 0:
        time.sleep(wait)

    try:
        response = requests.get(
            NOMINATIM,
            params={"q": place, "countrycodes": country.lower(), "format": "json", "limit": 1},
            headers={"User-Agent": NOMINATIM_UA},
            timeout=20,
        )
        _last_call = time.time()
        if response.status_code != 200:
            cache[key] = None
        else:
            hits = response.json()
            cache[key] = (
                {
                    "lat": float(hits[0]["lat"]),
                    "lon": float(hits[0]["lon"]),
                    "display": hits[0].get("display_name", "")[:120],
                }
                if hits
                else None
            )
    except Exception as exc:
        log.warning("geocode failed for %s: %s", place, type(exc).__name__)
        return None

    _save(GEOCACHE, cache)
    return cache[key]


# ── publisher standing ────────────────────────────────────────────────────

def update_publishers(domains: Iterable[str]) -> dict:
    """Track how often each outlet files.

    An allowlist nobody maintains goes stale; this one builds itself. A domain
    seen filing across many runs is an established outlet, a domain seen once
    is a blog that reposted something.
    """
    counts = _load(PUBLISHERS, {})
    for domain in domains:
        if domain:
            counts[domain] = counts.get(domain, 0) + 1
    _save(PUBLISHERS, counts)
    return counts


def publisher_standing(domain: str, counts: dict) -> tuple[float, str]:
    seen = counts.get(domain, 0)
    if seen >= 25:
        return 0.12, f"{domain} files regularly ({seen} stories seen)"
    if seen >= 5:
        return 0.06, f"{domain} seen before ({seen} stories)"
    return 0.0, ""


# ── corroboration across runs ─────────────────────────────────────────────

def record_and_count(report_id: str, domain: str, now: datetime) -> tuple[int, str]:
    """How many distinct outlets have carried this story, across all runs."""
    seen = _load(SEEN, {})
    entry = seen.get(report_id) or {"domains": [], "first": now.isoformat()}
    if domain and domain not in entry["domains"]:
        entry["domains"].append(domain)
    seen[report_id] = entry

    # Forget anything older than a month so the file cannot grow without bound.
    cutoff = (now - timedelta(days=30)).isoformat()
    seen = {k: v for k, v in seen.items() if v.get("first", "") >= cutoff}
    _save(SEEN, seen)

    count = len(entry["domains"])
    if count >= 3:
        return count, f"carried by {count} separate outlets"
    if count == 2:
        return count, "carried by a second outlet"
    return count, ""


# ── computational cross-check ─────────────────────────────────────────────

def pawukon_support(place: str, when: date, country: str) -> tuple[float, str]:
    """Does a Balinese report land on a day the calendar already predicts?

    This is the satisfying case: a deterministic Tier 1 source vouching for a
    scraped Tier 4 one. If a temple ceremony is reported for a day the pawukon
    marks as island-wide, the report is very likely real.
    """
    if country != "ID":
        return 0.0, ""
    try:
        from . import pawukon
    except ImportError:
        return 0.0, ""

    window = pawukon.island_festivals(when - timedelta(days=3), when + timedelta(days=3))
    if window:
        names = ", ".join(sorted({f["name"] for f in window}))
        return 0.20, f"falls in the {names} window, which the pawukon calendar predicts"
    return 0.0, ""


def catalogue_support(title: str, known_titles: Iterable[str]) -> tuple[float, str]:
    """Does the report name an event already in the curated catalogue?"""
    lowered = title.lower()
    for known in known_titles:
        if len(known) >= 6 and known.lower() in lowered:
            return 0.15, f"matches “{known}” in the curated catalogue"
    return 0.0, ""


# ── scoring ───────────────────────────────────────────────────────────────

MAX_CONFIDENCE = 0.7  # an unverified press report never reads as certain


def verify(candidates: list, known_titles: Iterable[str] | None = None) -> list:
    """Apply every signal, in place, and return the candidates."""
    known_titles = list(known_titles or [])
    now = datetime.now(timezone.utc)

    counts = update_publishers(c.source_domain for c in candidates)
    geocache = _load(GEOCACHE, {})

    for candidate in candidates:
        if candidate.kind == "none":
            continue

        bonus, reason = publisher_standing(candidate.source_domain, counts)
        if reason:
            candidate.confidence += bonus
            candidate.reasons.append(reason)

        _, reason = record_and_count(candidate.id, candidate.source_domain, now)
        if reason:
            # Independent outlets agreeing is the strongest thing here, even if
            # it is rarer than one would hope.
            candidate.confidence += 0.18
            candidate.reasons.append(reason)

        if candidate.place:
            hit = geocode(candidate.place, candidate.country, geocache)
            if hit:
                candidate.confidence += 0.10
                candidate.reasons.append(f"{candidate.place} resolves inside {candidate.country}")
                setattr(candidate, "coordinates", (hit["lat"], hit["lon"]))
            else:
                candidate.confidence -= 0.10
                candidate.reasons.append(f"could not locate “{candidate.place}” in {candidate.country}")

        bonus, reason = pawukon_support(
            candidate.place, candidate.published.date(), candidate.country
        )
        if reason:
            candidate.confidence += bonus
            candidate.reasons.append(reason)

        bonus, reason = catalogue_support(candidate.title, known_titles)
        if reason:
            candidate.confidence += bonus
            candidate.reasons.append(reason)

        candidate.confidence = max(0.0, min(MAX_CONFIDENCE, candidate.confidence))

    return candidates
