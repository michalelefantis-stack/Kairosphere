"""The confidence engine.

Four forces set a published confidence score:

  ceiling        a tier can never claim more certainty than its method allows
  decay          confidence falls off with time since last verification
  corroboration  independent sources agreeing lifts the score, with diminishing
                 returns, and only for tiers where agreement means something
  spread         a wide +/- window is less useful than a tight one

Decay is the mechanism that fixes a stale live map: an entry nobody has
re-verified visibly degrades instead of silently lying.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional

from .schema import PhenomenonEvent, Tier, utcnow, haversine_km

# A tier's method caps how confident it is honest to be.
TIER_CEILING: dict[Tier, float] = {
    Tier.DETERMINISTIC: 1.00,  # orbital mechanics does not miss
    Tier.MODEL: 0.90,          # published model skill, not truth
    Tier.CITIZEN: 0.75,        # observation density is a proxy, not a census
    Tier.CURATED: 0.85,        # a human confirmed it, and humans go quiet
}

# Days for confidence to halve. None means the value never goes stale.
TIER_HALF_LIFE_DAYS: dict[Tier, Optional[float]] = {
    Tier.DETERMINISTIC: None,
    Tier.MODEL: 3.0,     # an aurora nowcast is worthless by next week
    Tier.CITIZEN: 7.0,   # a bloom report ages out within a fortnight
    Tier.CURATED: 120.0, # a confirmed festival date holds most of a season
}

# Floor so a decayed entry keeps a visible trace rather than vanishing.
MIN_CONFIDENCE = 0.05

# Corroboration only means something where sources are actually independent.
CORROBORATION_TIERS = {Tier.MODEL, Tier.CITIZEN, Tier.CURATED}
CORROBORATION_PER_DOUBLING = 0.12
MAX_CORROBORATION = 1.30

# Uncertainty at which the spread factor reaches roughly half. Seasonal
# phenomena are legitimately +/- a week or two, so this is deliberately not
# tight enough to crush an honest bloom or migration window.
SPREAD_SCALE_DAYS = 14.0


@dataclass(frozen=True)
class ConfidenceBreakdown:
    """Why a score is what it is — surfaced so the UI can explain itself."""

    base: float
    ceiling: float
    decay_factor: float
    corroboration_factor: float
    spread_factor: float
    final: float

    def explain(self) -> str:
        return (
            f"base {self.base:.2f} x decay {self.decay_factor:.2f} "
            f"x sources {self.corroboration_factor:.2f} "
            f"x spread {self.spread_factor:.2f} "
            f"-> {self.final:.2f} (ceiling {self.ceiling:.2f})"
        )


def decay_factor(tier: Tier, staleness_days: float) -> float:
    """Exponential half-life decay on time since last verification."""
    half_life = TIER_HALF_LIFE_DAYS[tier]
    if half_life is None:
        return 1.0
    if staleness_days <= 0:
        return 1.0
    return 0.5 ** (staleness_days / half_life)


def corroboration_factor(tier: Tier, source_count: int) -> float:
    """Diminishing lift for independent agreement: +12% per doubling."""
    if tier not in CORROBORATION_TIERS or source_count <= 1:
        return 1.0
    lift = 1.0 + CORROBORATION_PER_DOUBLING * math.log2(source_count)
    return min(lift, MAX_CORROBORATION)


def spread_factor(uncertainty_days: float) -> float:
    """A hyperbolic penalty — +/-1 day barely costs, +/-30 days costs a lot."""
    return 1.0 / (1.0 + max(0.0, uncertainty_days) / SPREAD_SCALE_DAYS)


def score(event: PhenomenonEvent, now: Optional[datetime] = None) -> ConfidenceBreakdown:
    """Compute the published confidence for one event."""
    now = now or utcnow()
    staleness = (now - event.last_verified_at).total_seconds() / 86400.0

    ceiling = TIER_CEILING[event.tier]
    d = decay_factor(event.tier, staleness)
    c = corroboration_factor(event.tier, len(event.sources))
    s = spread_factor(event.uncertainty_days)

    raw = event.base_confidence * d * c * s
    final = max(MIN_CONFIDENCE, min(ceiling, raw))

    return ConfidenceBreakdown(
        base=event.base_confidence,
        ceiling=ceiling,
        decay_factor=d,
        corroboration_factor=c,
        spread_factor=s,
        final=final,
    )


def apply(events: Iterable[PhenomenonEvent], now: Optional[datetime] = None) -> list[PhenomenonEvent]:
    """Score every event in place and return them."""
    now = now or utcnow()
    scored = []
    for ev in events:
        ev.confidence = score(ev, now).final
        scored.append(ev)
    return scored


# ── reconciliation ────────────────────────────────────────────────────────

DUPLICATE_RADIUS_KM = 120.0


_STOPWORDS = {
    "the", "of", "de", "at", "in", "on", "and", "a", "an",
    "festival", "ceremony", "annual", "national", "show",
}

# Share of significant words two names must have in common to be the same
# phenomenon. Low enough to catch reorderings, high enough that the Perseids
# and the Orionids stay two meteor showers.
NAME_MATCH_THRESHOLD = 0.6


def _name_tokens(name: str) -> frozenset[str]:
    """Significant words of a name, order-independent."""
    cleaned = "".join(ch for ch in name.lower() if ch.isalnum() or ch.isspace())
    return frozenset(w for w in cleaned.split() if w not in _STOPWORDS)


def _names_match(a: str, b: str) -> bool:
    """Jaccard overlap of significant words.

    Compared as sets rather than as a sorted prefix, so "March Equinox at
    Chichen Itza" and "Chichen Itza March Equinox" resolve to one event.
    """
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return False
    if ta == tb:
        return True
    union = ta | tb
    return len(ta & tb) / len(union) >= NAME_MATCH_THRESHOLD


def _windows_overlap(a: PhenomenonEvent, b: PhenomenonEvent) -> bool:
    return a.window_start <= b.window_end and b.window_start <= a.window_end


def reconcile(events: list[PhenomenonEvent]) -> list[PhenomenonEvent]:
    """Merge records describing the same phenomenon.

    When two sources describe one event, the higher tier wins the window (a
    computed equinox beats a blog's guess at it), but the loser's source is
    kept as corroboration — which is what lifts the merged confidence.
    """
    merged: list[PhenomenonEvent] = []

    for ev in sorted(events, key=lambda e: (int(e.tier), -e.base_confidence)):
        match = None
        for existing in merged:
            if not _names_match(existing.name, ev.name):
                continue
            if not _windows_overlap(existing, ev):
                continue
            if haversine_km(existing.lat, existing.lon, ev.lat, ev.lon) > DUPLICATE_RADIUS_KM:
                continue
            match = existing
            break

        if match is None:
            merged.append(ev)
            continue

        # The kept record is the higher tier (sorted first), so it keeps its
        # window; the duplicate only contributes evidence and freshness.
        known = {(s.name, s.url) for s in match.sources}
        for src in ev.sources:
            if (src.name, src.url) not in known:
                match.sources.append(src)
        match.last_verified_at = max(match.last_verified_at, ev.last_verified_at)
        # A sacred or restricted duplicate drags the merged record to the
        # stricter setting — never the other way around.
        if ev.sensitivity.value != "public" and match.sensitivity.value == "public":
            match.sensitivity = ev.sensitivity
            match.precision = ev.precision

    return merged


def band(confidence: float) -> str:
    """Coarse label used for badge colour and copy.

    The floor band is 'speculative', not 'stale': a wide seasonal window is
    imprecise, which is a different failing from unverified. Staleness is
    carried separately by last_verified_at so the UI can say which one it is.
    """
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.45:
        return "medium"
    if confidence >= 0.20:
        return "low"
    return "speculative"
