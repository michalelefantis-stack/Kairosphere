"""Refuse to replace a good feed with a worse one.

Every adapter fails soft, which is right — one dead upstream should not sink a
run. But soft failures compound: if three sources time out at once, the run
still "succeeds" and quietly publishes a feed with a third of the events. On a
schedule, with nobody watching, that is how a live map goes wrong.

So the run is compared against what is already published, and a collapse is
treated as a failed run rather than a new truth. The old feed stays up, the
scheduler reports failure, and a human finds out.

    What is compared, and why it is not the published count

The published feed is what survives the horizon filter — currently seven days,
because the map is meant to answer "what can I still get to". That number
swings hard for reasons that have nothing to do with source health: a quiet
week has four events, the week of a full moon and two festivals has fifteen.
Gating on it means blocking good runs all summer and learning to ignore the
alarm.

So the comparison uses the *sourced* counts instead: how many events the
adapters returned and reconciled, before any horizon was applied. That is the
number a real outage moves, and it barely moves otherwise. It is also immune
to somebody changing the horizon, which is exactly what happened — the horizon
went from 120 days to 7, the published count fell from 18 to 4, and the gate
correctly-but-uselessly called it a collapse.

Feeds written before `counts.sourced` existed fall back to the old behaviour,
so the first run after this change still has something to compare against.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

# A run may lose this share of its sourced events before it is a collapse.
MAX_SHRINK_RATIO = 0.5
# Below this count the comparison is noise, so only "empty" is a failure.
MIN_MEANINGFUL_PREVIOUS = 8
# A tier has to have been carrying this much before vanishing is an outage.
MIN_MEANINGFUL_TIER = 3


@dataclass(frozen=True)
class GateResult:
    ok: bool
    reasons: list[str]
    summary: str

    def __bool__(self) -> bool:
        return self.ok


def _measure(payload: dict[str, Any]) -> tuple[int, dict[str, int], bool]:
    """Total and per-tier counts to judge a feed by, and whether they are sourced.

    Sourced counts are preferred; a feed from before they existed is measured
    on what it published, which is all it recorded.
    """
    counts = payload.get("counts") or {}
    sourced = counts.get("sourced") or {}

    if "reconciled" in sourced:
        return int(sourced["reconciled"]), dict(sourced.get("byTier") or {}), True

    return len(payload.get("events") or []), dict(counts.get("byTier") or {}), False


def check(new: dict[str, Any], previous: Optional[dict[str, Any]]) -> GateResult:
    """Decide whether `new` is fit to publish over `previous`."""
    reasons: list[str] = []

    new_total, new_tiers, sourced = _measure(new)
    published = len(new.get("events") or [])

    # Nothing sourced at all means every adapter failed together.
    if new_total == 0:
        reasons.append(
            "run sourced zero events" if sourced else "run produced zero events"
        )

    # Tier 1 is pure maths with no upstream. If it is missing, the failure is
    # in this code, not in somebody's API, and it must not ship. Judged before
    # the horizon: a week with no eclipse in it is not a broken ephemeris.
    if new_total and not new_tiers.get("1"):
        reasons.append("no tier-1 deterministic events — computation itself failed")

    if previous:
        previous_total, previous_tiers, previous_sourced = _measure(previous)

        # Only compare like with like. A sourced count and a published count
        # are different measurements, and the run that introduces the sourced
        # ones would otherwise read as a collapse against the old feed.
        comparable = sourced == previous_sourced

        if comparable and previous_total >= MIN_MEANINGFUL_PREVIOUS and new_total:
            floor = previous_total * MAX_SHRINK_RATIO
            if new_total < floor:
                reasons.append(
                    f"event count collapsed: {new_total} vs {previous_total} "
                    f"previously (floor {floor:.0f})"
                )

        # Losing an entire tier that was working is a source outage, not news.
        if comparable:
            for tier, count in previous_tiers.items():
                if int(count) >= MIN_MEANINGFUL_TIER and not new_tiers.get(tier):
                    reasons.append(f"tier {tier} went from {count} events to none")

    detail = f"{new_total} sourced, {published} published" if sourced else f"{published} events"
    if previous:
        was, _, _ = _measure(previous)
        detail += f" (was {was})"
    else:
        detail += " (no previous feed)"

    return GateResult(ok=not reasons, reasons=reasons, summary=detail)
