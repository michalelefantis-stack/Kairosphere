"""Tests for the parts that must not drift.

    python -m unittest discover -s pipeline/tests -v

No network: every case here exercises math, scoring, or the sensitivity gate.
"""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote

from pipeline import astro, calendars, confidence, images
from pipeline.confidence import ConfidenceBreakdown, band, reconcile, score
from pipeline.schema import (
    Category,
    PhenomenonEvent,
    Precision,
    Sensitivity,
    SourceKind,
    SourceRef,
    Tier,
    stable_id,
)
from pipeline.sources import curated

ROOT = Path(__file__).resolve().parents[2]


def utc(y, m, d, hh=0, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=timezone.utc)


def make_event(**overrides) -> PhenomenonEvent:
    defaults = dict(
        id="test-1",
        name="Test Event",
        description="",
        category=Category.RITUAL,
        tier=Tier.CURATED,
        lat=0.0,
        lon=0.0,
        location_hint="Nowhere",
        country="Nowhere",
        window_start=utc(2026, 6, 1),
        window_end=utc(2026, 6, 3),
        uncertainty_days=0.0,
        base_confidence=0.8,
        last_verified_at=utc(2026, 6, 1),
    )
    defaults.update(overrides)
    return PhenomenonEvent(**defaults)


class TestAstronomy(unittest.TestCase):
    """Meeus implementations, checked against published values."""

    def test_equinoxes_and_solstices_2026(self):
        # Published UTC instants; allow two minutes of slack.
        expected = {
            "march_equinox": utc(2026, 3, 20, 14, 46),
            "june_solstice": utc(2026, 6, 21, 8, 24),
            "september_equinox": utc(2026, 9, 23, 0, 5),
            "december_solstice": utc(2026, 12, 21, 20, 50),
        }
        for name, want in expected.items():
            got = astro.solar_event(2026, name)
            delta = abs((got - want).total_seconds())
            self.assertLess(delta, 120, f"{name}: got {got}, want {want}")

    def test_moon_phases_2026(self):
        full = astro.phases_in_range(utc(2026, 1, 1), utc(2026, 2, 15), "full")
        self.assertTrue(full)
        self.assertLess(abs((full[0] - utc(2026, 1, 3, 10, 3)).total_seconds()), 120)

        new = astro.phases_in_range(utc(2026, 1, 1), utc(2026, 2, 15), "new")
        self.assertTrue(new)
        self.assertLess(abs((new[0] - utc(2026, 1, 18, 19, 52)).total_seconds()), 120)

    def test_illumination_extremes(self):
        self.assertGreater(astro.moon_illumination_fraction(utc(2026, 1, 3, 10, 3)), 0.98)
        self.assertLess(astro.moon_illumination_fraction(utc(2026, 1, 18, 19, 52)), 0.02)

    def test_phases_in_range_rejects_nothing_silently(self):
        # An empty range must yield an empty list, not loop forever.
        self.assertEqual(astro.phases_in_range(utc(2026, 5, 1), utc(2026, 5, 1), "full"), [])


class TestCalendars(unittest.TestCase):
    def test_chinese_new_year(self):
        for year, expected in [
            (2024, (2, 10)), (2025, (1, 29)), (2026, (2, 17)), (2027, (2, 6)),
        ]:
            got = calendars.chinese_new_year(year)
            self.assertEqual((got.month, got.day), expected, f"CNY {year} -> {got}")

    def test_diwali_lands_in_the_kartika_window(self):
        for year in (2024, 2025, 2026, 2027):
            got = calendars.diwali(year)
            self.assertIn(got.month, (10, 11), f"Diwali {year} -> {got}")

    def test_islamic_dates_within_sighting_tolerance(self):
        # Tabular reckoning; published observance can differ by a day.
        ashura = calendars.islamic_festival(1447, 1, 10)
        self.assertEqual((ashura.year, ashura.month), (2025, 7))
        self.assertLessEqual(abs(ashura.day - 6), 1)

        eid = calendars.islamic_festival(1447, 10, 1)
        self.assertEqual((eid.year, eid.month), (2026, 3))
        self.assertLessEqual(abs(eid.day - 20), 1)

    def test_hijri_overlap_covers_the_year(self):
        self.assertIn(1447, calendars.hijri_years_overlapping(2026))


class TestConfidenceEngine(unittest.TestCase):
    def test_deterministic_never_decays(self):
        event = make_event(
            tier=Tier.DETERMINISTIC,
            base_confidence=1.0,
            last_verified_at=utc(2020, 1, 1),  # ancient
        )
        self.assertAlmostEqual(score(event, utc(2026, 6, 1)).final, 1.0, places=6)

    def test_model_feed_halves_at_its_half_life(self):
        verified = utc(2026, 6, 1)
        event = make_event(tier=Tier.MODEL, base_confidence=0.8, last_verified_at=verified)
        fresh = score(event, verified).final
        later = score(event, verified + timedelta(days=3)).final
        self.assertAlmostEqual(later / fresh, 0.5, places=3)

    def test_confidence_is_capped_by_tier_ceiling(self):
        event = make_event(tier=Tier.CITIZEN, base_confidence=1.0, uncertainty_days=0.0)
        event.sources = [
            SourceRef(name=f"s{i}", url=f"http://x/{i}", kind=SourceKind.CITIZEN)
            for i in range(16)
        ]
        self.assertLessEqual(score(event).final, confidence.TIER_CEILING[Tier.CITIZEN])

    def test_corroboration_lifts_but_not_for_deterministic(self):
        one = confidence.corroboration_factor(Tier.CURATED, 1)
        four = confidence.corroboration_factor(Tier.CURATED, 4)
        self.assertGreater(four, one)
        # A second opinion on an equinox is not evidence.
        self.assertEqual(confidence.corroboration_factor(Tier.DETERMINISTIC, 5), 1.0)

    def test_wider_uncertainty_scores_lower(self):
        tight = make_event(uncertainty_days=1.0)
        loose = make_event(uncertainty_days=30.0)
        self.assertGreater(score(tight).final, score(loose).final)

    def test_confidence_never_hits_zero(self):
        event = make_event(tier=Tier.MODEL, base_confidence=0.9, last_verified_at=utc(2000, 1, 1))
        self.assertGreaterEqual(score(event).final, confidence.MIN_CONFIDENCE)

    def test_bands(self):
        self.assertEqual(band(0.90), "high")
        self.assertEqual(band(0.50), "medium")
        self.assertEqual(band(0.25), "low")
        self.assertEqual(band(0.10), "speculative")

    def test_breakdown_explains_itself(self):
        result = score(make_event())
        self.assertIsInstance(result, ConfidenceBreakdown)
        self.assertIn("->", result.explain())


class TestReconciliation(unittest.TestCase):
    def test_duplicates_merge_and_keep_the_higher_tier_window(self):
        computed = make_event(
            id="a", name="March Equinox at Chichen Itza", tier=Tier.DETERMINISTIC,
            lat=20.68, lon=-88.57, window_start=utc(2026, 3, 20), window_end=utc(2026, 3, 21),
            sources=[SourceRef(name="meeus", url="http://m", kind=SourceKind.DETERMINISTIC)],
        )
        blogged = make_event(
            id="b", name="Chichen Itza March Equinox", tier=Tier.CURATED,
            lat=20.69, lon=-88.56, window_start=utc(2026, 3, 19), window_end=utc(2026, 3, 22),
            sources=[SourceRef(name="blog", url="http://b", kind=SourceKind.CURATED)],
        )
        merged = reconcile([blogged, computed])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].tier, Tier.DETERMINISTIC)
        self.assertEqual(merged[0].window_start, utc(2026, 3, 20))
        self.assertEqual(len(merged[0].sources), 2)  # loser kept as corroboration

    def test_distant_events_with_the_same_name_stay_separate(self):
        a = make_event(id="a", name="Full Moon Festival", lat=10, lon=10)
        b = make_event(id="b", name="Full Moon Festival", lat=-40, lon=150)
        self.assertEqual(len(reconcile([a, b])), 2)

    def test_stricter_sensitivity_wins_the_merge(self):
        public = make_event(id="a", name="Same Rite", tier=Tier.DETERMINISTIC)
        restricted = make_event(
            id="b", name="Same Rite", tier=Tier.CURATED,
            sensitivity=Sensitivity.RESTRICTED, precision=Precision.COUNTRY,
        )
        merged = reconcile([public, restricted])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].sensitivity, Sensitivity.RESTRICTED)


class TestSchemaGuards(unittest.TestCase):
    def test_sacred_is_never_publishable(self):
        self.assertFalse(make_event(sensitivity=Sensitivity.SACRED).publishable)
        self.assertTrue(make_event(sensitivity=Sensitivity.RESTRICTED).publishable)

    def test_coordinates_are_rounded_to_declared_precision(self):
        event = make_event(lat=15.123456, lon=10.987654, precision=Precision.COUNTRY)
        self.assertEqual(event.published_coords(), (15, 11))

        event.precision = Precision.REGIONAL
        self.assertEqual(event.published_coords(), (15.1, 11.0))

        event.precision = Precision.POINT
        self.assertEqual(event.published_coords(), (15.1235, 10.9877))

    def test_serialized_payload_publishes_rounded_coordinates(self):
        event = make_event(lat=15.123456, lon=10.987654, precision=Precision.COUNTRY)
        self.assertEqual(event.to_dict()["coordinates"], [15, 11])

    def test_backwards_window_is_rejected(self):
        with self.assertRaises(ValueError):
            make_event(window_start=utc(2026, 6, 5), window_end=utc(2026, 6, 1))

    def test_coordinates_off_the_globe_are_rejected(self):
        with self.assertRaises(ValueError):
            make_event(lat=91.0)

    def test_stable_id_is_stable_and_distinct(self):
        self.assertEqual(stable_id("x", "a", 1), stable_id("x", "a", 1))
        self.assertNotEqual(stable_id("x", "a", 1), stable_id("x", "a", 2))


class TestSensitivityGate(unittest.TestCase):
    """The registry ships a sacred entry precisely so this can be asserted."""

    def test_registry_contains_the_canary(self):
        raw = curated._load()
        canaries = [e for e in raw if e.get("sensitivity") == "sacred"]
        self.assertTrue(canaries, "expected a sacred entry in the registry as a live test")
        # It is marked published on purpose — the gate, not the flag, must stop it.
        self.assertTrue(any(e.get("reviewStatus") == "published" for e in canaries))

    def test_sacred_entries_never_reach_output(self):
        published_ids = {e.id for e in curated.fetch()}
        for entry in curated._load():
            if entry.get("sensitivity") == "sacred":
                leaked = [pid for pid in published_ids if entry["id"] in pid]
                self.assertEqual(leaked, [], f"sacred entry leaked: {entry['id']}")

    def test_restricted_entries_are_never_point_precise(self):
        for event in curated.fetch():
            if event.sensitivity is Sensitivity.RESTRICTED:
                self.assertNotEqual(event.precision, Precision.POINT, event.name)


class TestImageEvidence(unittest.TestCase):
    """Guards on what counts as proof that a photo shows the right thing.

    Written after the matcher put a Jim Crow segregation cartoon on Crow
    Fair, an Apsáalooke powwow, having vouched for it with "crow + united".
    Both words matched. Neither meant anything. That failure is worse than
    showing no photograph at all, so it gets a test rather than a fix.
    """

    def test_country_words_do_not_corroborate_a_place(self):
        for word in ("united", "states", "new", "south", "republic"):
            self.assertFalse(
                images._corroborates_place(word),
                f'"{word}" is too generic to place a photograph',
            )

    def test_real_place_names_do_corroborate(self):
        for word in ("varanasi", "sumba", "oaxaca", "shetland"):
            self.assertTrue(images._corroborates_place(word), word)

    def test_maps_and_charts_are_not_photographs(self):
        self.assertFalse(
            images._is_photograph(
                "Countries where Eid al-Fitr is an Official Public Holiday", ""
            )
        )
        self.assertFalse(images._is_photograph("Flag of Nepal", ""))

    def test_geograph_credit_is_not_mistaken_for_a_chart(self):
        # "graph" as a substring matched geograph.org.uk and rejected a large
        # source of good landscape photography.
        self.assertTrue(
            images._is_photograph("Brocken Spectre - geograph.org.uk - 332287", "")
        )

    def test_shipped_overlay_carries_no_generic_corroboration(self):
        """The published mapping must satisfy the same rule, not just future runs."""
        path = ROOT / "public" / "data" / "event_images.json"
        images_by_id = json.loads(path.read_text(encoding="utf-8"))["images"]

        offenders = []
        for event_id, record in images_by_id.items():
            if record.get("via") != "commons-search":
                continue
            parts = [p.strip().lower() for p in record.get("verifiedBy", "").split("+")]
            if len(parts) == 2 and parts[1] in images.GENERIC_PLACE_WORDS:
                title = unquote(record.get("sourcePage", "").rsplit("/", 1)[-1])
                # Exempt when the filename itself names the subject.
                if not any(len(t) > 5 and t in title.lower()
                           for t in event_id.lower().split("-")):
                    offenders.append(event_id)

        self.assertEqual(offenders, [], f"weakly-matched photographs: {offenders}")


if __name__ == "__main__":
    unittest.main()
