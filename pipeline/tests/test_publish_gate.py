"""The gate that decides whether a scheduled run may replace the live feed.

It had no tests, and it was blocking every run: the horizon moved from 120
days to 7, the published count fell from 18 to 4, and the gate called a
deliberate change a collapse. On a two-hourly schedule that means the feed
freezes and the failure looks like an outage.
"""

import unittest

from pipeline import publish_gate


def feed(published=1, *, sourced=None, tiers=None, sourced_tiers=None):
    """A payload shaped like pipeline.run.to_payload writes them."""
    counts = {
        "total": published,
        "byTier": tiers if tiers is not None else {"1": published},
    }
    if sourced is not None:
        counts["sourced"] = {
            "collected": sourced,
            "reconciled": sourced,
            "byTier": sourced_tiers if sourced_tiers is not None else {"1": sourced},
        }
    return {"counts": counts, "events": [{"id": f"e{i}"} for i in range(published)]}


class SourcedComparison(unittest.TestCase):
    def test_horizon_shrink_does_not_block(self):
        """The case that was blocking every run.

        Same sources, same health, far fewer events published because the
        horizon narrowed. That is a decision, not an outage.
        """
        previous = feed(18, sourced=64)
        new = feed(4, sourced=64)
        result = publish_gate.check(new, previous)
        self.assertTrue(result.ok, result.reasons)

    def test_quiet_week_publishes_nothing_without_failing(self):
        """Zero events inside the horizon is honest when the sources answered."""
        previous = feed(12, sourced=64)
        new = feed(0, sourced=61)
        result = publish_gate.check(new, previous)
        self.assertTrue(result.ok, result.reasons)

    def test_source_collapse_still_blocks(self):
        """Half the adapters dying is what this gate exists for."""
        previous = feed(12, sourced=64)
        new = feed(11, sourced=20)
        result = publish_gate.check(new, previous)
        self.assertFalse(result.ok)
        self.assertIn("collapsed", " ".join(result.reasons))

    def test_everything_dead_blocks(self):
        result = publish_gate.check(feed(0, sourced=0), feed(12, sourced=64))
        self.assertFalse(result.ok)
        self.assertIn("sourced zero events", " ".join(result.reasons))

    def test_tier_outage_blocks(self):
        previous = feed(12, sourced=64, sourced_tiers={"1": 40, "3": 24})
        new = feed(9, sourced=40, sourced_tiers={"1": 40})
        result = publish_gate.check(new, previous)
        self.assertFalse(result.ok)
        self.assertIn("tier 3", " ".join(result.reasons))

    def test_tier_one_missing_blocks(self):
        """Tier 1 is pure maths. Its absence is a bug here, not an outage."""
        new = feed(9, sourced=40, sourced_tiers={"2": 40})
        result = publish_gate.check(new, feed(12, sourced=64))
        self.assertFalse(result.ok)
        self.assertIn("tier-1", " ".join(result.reasons))

    def test_tier_one_may_be_absent_from_the_published_slice(self):
        """A week with no eclipse in it is not a broken ephemeris."""
        new = feed(3, sourced=64, tiers={"3": 3}, sourced_tiers={"1": 40, "3": 24})
        result = publish_gate.check(new, feed(12, sourced=64, sourced_tiers={"1": 40, "3": 24}))
        self.assertTrue(result.ok, result.reasons)


class Compatibility(unittest.TestCase):
    def test_first_sourced_run_is_not_compared_to_an_older_feed(self):
        """A sourced count and a published count are different measurements."""
        previous = feed(18)              # written before counts.sourced existed
        new = feed(4, sourced=64)
        result = publish_gate.check(new, previous)
        self.assertTrue(result.ok, result.reasons)

    def test_old_style_feeds_still_gate_on_published_counts(self):
        result = publish_gate.check(feed(3), feed(18))
        self.assertFalse(result.ok)
        self.assertIn("collapsed", " ".join(result.reasons))

    def test_no_previous_feed_publishes(self):
        self.assertTrue(publish_gate.check(feed(4, sourced=64), None).ok)

    def test_small_previous_feed_is_not_a_baseline(self):
        """Below MIN_MEANINGFUL_PREVIOUS the comparison is noise."""
        result = publish_gate.check(feed(1, sourced=2), feed(5, sourced=6))
        self.assertTrue(result.ok, result.reasons)


if __name__ == "__main__":
    unittest.main()
