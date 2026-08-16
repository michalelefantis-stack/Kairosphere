"""Refuse to replace a good feed with a worse one.

Every adapter fails soft, which is right — one dead upstream should not sink a
run. But soft failures compound: if three sources time out at once, the run
still "succeeds" and quietly publishes a feed with a third of the events. On a
schedule, with nobody watching, that is how a live map goes wrong.

So the run is compared against what is already published, and a collapse is
treated as a failed run rather than a new truth. The old feed stays up, the
scheduler reports failure, and a human finds out.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

# A run may lose this share of its events before it is treated as a collapse.
MAX_SHRINK_RATIO = 0.5
# Below this count the comparison is noise, so only "empty" is a failure.
MIN_MEANINGFUL_PREVIOUS = 8


@dataclass(frozen=True)
class GateResult:
    ok: bool
    reasons: list[str]
    summary: str

    def __bool__(self) -> bool:
        return self.ok


def _tier_counts(payload: dict[str, Any]) -> dict[str, int]:
    return (payload.get("counts") or {}).get("byTier") or {}


def check(new: dict[str, Any], previous: Optional[dict[str, Any]]) -> GateResult:
    """Decide whether `new` is fit to publish over `previous`."""
    reasons: list[str] = []

    new_events = new.get("events") or []
    new_total = len(new_events)

    # An empty feed is never publishable, with or without a predecessor.
    if new_total == 0:
        reasons.append("run produced zero events")

    # Tier 1 is pure math with no upstream. If it is missing, the failure is
    # in this code, not in somebody's API, and it must not ship.
    if new_total and not _tier_counts(new).get("1"):
        reasons.append("no tier-1 deterministic events — computation itself failed")

    if previous:
        previous_total = len(previous.get("events") or [])
        if previous_total >= MIN_MEANINGFUL_PREVIOUS and new_total:
            floor = previous_total * MAX_SHRINK_RATIO
            if new_total < floor:
                reasons.append(
                    f"event count collapsed: {new_total} vs {previous_total} "
                    f"previously (floor {floor:.0f})"
                )

        # Losing an entire tier that was working is a source outage, not news.
        previous_tiers = _tier_counts(previous)
        new_tiers = _tier_counts(new)
        for tier, count in previous_tiers.items():
            if count >= 3 and not new_tiers.get(tier):
                reasons.append(f"tier {tier} went from {count} events to none")

    summary = (
        f"{new_total} events"
        + (f" (was {len(previous.get('events') or [])})" if previous else " (no previous feed)")
    )
    return GateResult(ok=not reasons, reasons=reasons, summary=summary)
