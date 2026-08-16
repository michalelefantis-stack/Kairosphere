"""The single normalized event schema every source adapter emits.

Every record carries its predicted window, how wide the uncertainty is, where
it came from, and when it was last verified. Those four things are what let the
confidence engine reconcile a NASA model feed against a village elder's word.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """ISO-8601 with a Z suffix, which is what the frontend's Date() wants."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class Tier(int, Enum):
    DETERMINISTIC = 1  # computable from math; no feed can contradict it
    MODEL = 2          # published scientific model output
    CITIZEN = 3        # aggregated crowd observations
    CURATED = 4        # a human wrote it down and signed off


class SourceKind(str, Enum):
    DETERMINISTIC = "deterministic"
    MODEL = "model"
    CITIZEN = "citizen"
    CURATED = "curated"


class Category(str, Enum):
    """Mirrors EventCategory in types.ts so the frontend needs no translation."""

    RITUAL = "Human Ritual"
    MIGRATION = "Animal Migration"
    FLORA = "Botanical Event"
    COSMIC = "Cosmic Event"
    ATMOSPHERIC = "Atmospheric Phenomenon"
    UNREST = "Civil Unrest"


class Sensitivity(str, Enum):
    """Ethical gate for ceremonies that were not offered to outsiders.

    PUBLIC     — openly promoted by the community or a tourism board
    RESTRICTED — real but the community limits access; coordinates are blurred
    SACRED     — not for visitors; never published regardless of consent flags
    """

    PUBLIC = "public"
    RESTRICTED = "restricted"
    SACRED = "sacred"


class Precision(str, Enum):
    POINT = "point"        # exact venue
    REGIONAL = "regional"  # blurred to ~50km
    COUNTRY = "country"    # country centroid only


# How much a published coordinate gets rounded, in decimal degrees.
_PRECISION_ROUNDING = {
    Precision.POINT: 4,     # ~11 m
    Precision.REGIONAL: 1,  # ~11 km
    Precision.COUNTRY: 0,   # ~111 km
}


@dataclass
class SourceRef:
    """One piece of evidence behind an event's timing."""

    name: str
    url: str
    kind: SourceKind
    retrieved_at: datetime = field(default_factory=utcnow)
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "url": self.url,
            "kind": self.kind.value,
            "retrievedAt": iso(self.retrieved_at),
            "note": self.note,
        }


@dataclass
class PhenomenonEvent:
    """A predicted window for one thing happening somewhere on Earth."""

    id: str
    name: str
    description: str
    category: Category
    tier: Tier

    lat: float
    lon: float
    location_hint: str
    country: str

    window_start: datetime
    window_end: datetime
    uncertainty_days: float
    peak: Optional[datetime] = None

    # What the adapter believes before decay and corroboration are applied.
    base_confidence: float = 0.5
    # Filled in by the confidence engine; -1 means "not scored yet".
    confidence: float = -1.0

    sources: list[SourceRef] = field(default_factory=list)
    last_verified_at: datetime = field(default_factory=utcnow)

    emoji: str = "🌍"
    sensitivity: Sensitivity = Sensitivity.PUBLIC
    precision: Precision = Precision.POINT
    consent: str = ""  # who cleared this for publication, for tiers 3-4
    recurrence: str = ""  # human-readable cadence, e.g. "annual, lunar"

    def __post_init__(self) -> None:
        if self.window_end < self.window_start:
            raise ValueError(
                f"event {self.id}: window_end {self.window_end} precedes "
                f"window_start {self.window_start}"
            )
        if self.uncertainty_days < 0:
            raise ValueError(f"event {self.id}: negative uncertainty")
        if not -90 <= self.lat <= 90 or not -180 <= self.lon <= 180:
            raise ValueError(f"event {self.id}: coordinates off the globe")

    # ── derived properties ────────────────────────────────────────────────

    @property
    def window_days(self) -> float:
        return (self.window_end - self.window_start).total_seconds() / 86400.0

    @property
    def staleness_days(self) -> float:
        return (utcnow() - self.last_verified_at).total_seconds() / 86400.0

    def is_active(self, now: Optional[datetime] = None) -> bool:
        now = now or utcnow()
        return self.window_start <= now <= self.window_end

    def is_within(self, now: datetime, horizon_days: float) -> bool:
        """True if the window overlaps [now, now + horizon]."""
        horizon = now.timestamp() + horizon_days * 86400.0
        return self.window_end.timestamp() >= now.timestamp() and (
            self.window_start.timestamp() <= horizon
        )

    @property
    def publishable(self) -> bool:
        """Sacred events never ship, no matter what else is set."""
        return self.sensitivity is not Sensitivity.SACRED

    def published_coords(self) -> tuple[float, float]:
        """Coordinates rounded to the precision this event is allowed to claim."""
        digits = _PRECISION_ROUNDING[self.precision]
        if digits == 0:
            return (round(self.lat), round(self.lon))
        return (round(self.lat, digits), round(self.lon, digits))

    # ── serialization ─────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        lat, lon = self.published_coords()
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "emoji": self.emoji,
            "tier": int(self.tier),
            "coordinates": [lat, lon],
            "locationHint": self.location_hint,
            "country": self.country,
            "windowStart": iso(self.window_start),
            "windowEnd": iso(self.window_end),
            "peak": iso(self.peak) if self.peak else None,
            "uncertaintyDays": round(self.uncertainty_days, 2),
            "confidence": round(self.confidence, 3),
            "baseConfidence": round(self.base_confidence, 3),
            "lastVerifiedAt": iso(self.last_verified_at),
            "sources": [s.to_dict() for s in self.sources],
            "sensitivity": self.sensitivity.value,
            "precision": self.precision.value,
            "consent": self.consent,
            "recurrence": self.recurrence,
        }


def stable_id(prefix: str, *parts: Any) -> str:
    """Deterministic id so the same event keeps its identity across runs."""
    raw = "|".join(str(p) for p in parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
