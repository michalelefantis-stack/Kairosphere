"""Tier 1 — events that are computed, not fetched.

Nothing here touches the network. Every entry is reproducible from the math in
astro.py and calendars.py, which is why these carry the only confidence of 1.0
in the system.

Astronomical moments are global, but a map needs a place. Each is anchored to
the site where the moment is actually observed as a ritual — the June solstice
at Stonehenge, the equinox serpent at Chichen Itza — rather than to an
arbitrary point.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..astro import moon_illumination_fraction, phases_in_range, solar_event
from ..calendars import (
    ISLAMIC_OBSERVANCES,
    chinese_new_year,
    diwali,
    full_moon_festival,
    hijri_years_overlapping,
    islamic_festival,
)
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

MEEUS = SourceRef(
    name="Meeus, Astronomical Algorithms (2nd ed.)",
    url="https://www.willbell.com/math/mc1.htm",
    kind=SourceKind.DETERMINISTIC,
    note="Computed locally; no feed involved.",
)


def _calendar_source(note: str) -> SourceRef:
    return SourceRef(
        name="Calendrical conversion",
        url="https://www.staff.science.uu.nl/~gent0113/islam/islam_tabcal.htm",
        kind=SourceKind.DETERMINISTIC,
        note=note,
    )


# ── solar alignment sites ─────────────────────────────────────────────────

# (site, lat, lon, country, event key, emoji, what actually happens there)
ALIGNMENT_SITES = [
    (
        "Stonehenge", 51.1789, -1.8262, "United Kingdom", "june_solstice", "🌄",
        "Sunrise aligns with the Heel Stone along the avenue; the largest "
        "open-access gathering of the English ritual year.",
    ),
    (
        "Newgrange", 53.6947, -6.4755, "Ireland", "december_solstice", "🌅",
        "For about seventeen minutes after dawn a shaft of light travels the "
        "passage to the chamber floor — a 5,200-year-old alignment.",
    ),
    (
        "Chichen Itza", 20.6843, -88.5678, "Mexico", "march_equinox", "🐍",
        "Late-afternoon light steps down the balustrade of El Castillo, "
        "forming the descending serpent Kukulkan.",
    ),
    (
        "Chichen Itza", 20.6843, -88.5678, "Mexico", "september_equinox", "🐍",
        "The autumn repeat of the serpent shadow, with far thinner crowds "
        "than the March alignment.",
    ),
    (
        "Machu Picchu (Intihuatana)", -13.1631, -72.5450, "Peru", "june_solstice", "☀️",
        "Southern winter solstice — Inti Raymi, the Inca sun festival, is "
        "staged in Cusco in the days around it.",
    ),
    (
        "Karnak Temple", 25.7188, 32.6573, "Egypt", "december_solstice", "🏛️",
        "Sunrise runs the temple's main axis into the sanctuary of Amun-Re.",
    ),
]

SOLAR_LABEL = {
    "march_equinox": "March Equinox",
    "june_solstice": "June Solstice",
    "september_equinox": "September Equinox",
    "december_solstice": "December Solstice",
}


def solar_alignments(years: list[int]) -> list[PhenomenonEvent]:
    events: list[PhenomenonEvent] = []
    for year in years:
        for site, lat, lon, country, key, emoji, blurb in ALIGNMENT_SITES:
            moment = solar_event(year, key)
            events.append(
                PhenomenonEvent(
                    id=stable_id("astro-align", site, key, year),
                    name=f"{SOLAR_LABEL[key]} at {site}",
                    description=blurb,
                    category=Category.COSMIC,
                    tier=Tier.DETERMINISTIC,
                    lat=lat,
                    lon=lon,
                    location_hint=site,
                    country=country,
                    # The alignment is visible for a day either side.
                    window_start=moment - timedelta(days=1),
                    window_end=moment + timedelta(days=1),
                    peak=moment,
                    uncertainty_days=0.0,
                    base_confidence=1.0,
                    sources=[MEEUS],
                    last_verified_at=utcnow(),
                    emoji=emoji,
                    recurrence="annual, solar",
                )
            )
    return events


# ── meteor showers ────────────────────────────────────────────────────────

# (name, peak month, peak day, active span days, ZHR, hemisphere, emoji)
METEOR_SHOWERS = [
    ("Quadrantids", 1, 3, 2, 110, "north", "☄️"),
    ("Lyrids", 4, 22, 3, 18, "north", "☄️"),
    ("Eta Aquariids", 5, 6, 5, 50, "south", "☄️"),
    ("Delta Aquariids", 7, 30, 6, 25, "south", "☄️"),
    ("Perseids", 8, 12, 4, 100, "north", "☄️"),
    ("Draconids", 10, 8, 2, 10, "north", "☄️"),
    ("Orionids", 10, 21, 5, 20, "both", "☄️"),
    ("Southern Taurids", 11, 5, 10, 5, "both", "☄️"),
    ("Leonids", 11, 17, 3, 15, "both", "☄️"),
    ("Geminids", 12, 14, 3, 150, "both", "☄️"),
    ("Ursids", 12, 22, 2, 10, "north", "☄️"),
]

# Dark-sky anchors, chosen for sky quality and accessibility.
DARK_SKY = {
    "north": ("Cherry Springs Dark Sky Park", 41.6634, -77.8261, "United States"),
    "south": ("Aoraki Mackenzie Dark Sky Reserve", -43.7340, 170.0964, "New Zealand"),
    "both": ("Atacama Desert (ALMA plateau)", -23.0294, -67.7548, "Chile"),
}

IMO = SourceRef(
    name="IMO Meteor Shower Calendar",
    url="https://www.imo.net/resources/calendar/",
    kind=SourceKind.DETERMINISTIC,
    note="Peak dates are stable year to year; ZHR is the published nominal rate.",
)


def meteor_showers(years: list[int]) -> list[PhenomenonEvent]:
    """Shower peaks, with the moon's interference scored into the description."""
    events: list[PhenomenonEvent] = []
    for year in years:
        for name, month, day, span, zhr, hemi, emoji in METEOR_SHOWERS:
            peak = datetime(year, month, day, 2, 0, tzinfo=timezone.utc)
            site, lat, lon, country = DARK_SKY[hemi]

            illum = moon_illumination_fraction(peak)
            if illum < 0.25:
                viewing = "Dark skies at peak — near-ideal viewing."
            elif illum < 0.6:
                viewing = f"Moon {round(illum * 100)}% lit; fainter trails will be washed out."
            else:
                viewing = f"Moon {round(illum * 100)}% lit — a poor year for this shower."

            events.append(
                PhenomenonEvent(
                    id=stable_id("astro-meteor", name, year),
                    name=f"{name} Meteor Shower",
                    description=(
                        f"Peak rate around {zhr} meteors/hour under ideal conditions. "
                        f"{viewing}"
                    ),
                    category=Category.COSMIC,
                    tier=Tier.DETERMINISTIC,
                    lat=lat,
                    lon=lon,
                    location_hint=site,
                    country=country,
                    window_start=peak - timedelta(days=span),
                    window_end=peak + timedelta(days=span),
                    peak=peak,
                    # Peak timing drifts a few hours between years.
                    uncertainty_days=0.5,
                    base_confidence=1.0,
                    sources=[MEEUS, IMO],
                    last_verified_at=utcnow(),
                    emoji=emoji,
                    recurrence="annual",
                )
            )
    return events


# ── calendrical religious observances ─────────────────────────────────────

# Anchor sites for Islamic observances: where the observance is most visibly
# enacted, not where it is exclusively practised.
ISLAMIC_ANCHORS = {
    "Ashura": ("Karbala", 32.6160, 44.0249, "Iraq"),
    "Mawlid al-Nabi": ("Medina", 24.4686, 39.6142, "Saudi Arabia"),
    "Start of Ramadan": ("Mecca", 21.4225, 39.8262, "Saudi Arabia"),
    "Laylat al-Qadr (27 Ramadan)": ("Mecca", 21.4225, 39.8262, "Saudi Arabia"),
    "Eid al-Fitr": ("Mecca", 21.4225, 39.8262, "Saudi Arabia"),
    "Day of Arafah": ("Mount Arafat", 21.3549, 39.9840, "Saudi Arabia"),
    "Eid al-Adha": ("Mina", 21.4133, 39.8933, "Saudi Arabia"),
}

ISLAMIC_BLURB = {
    "Ashura": (
        "Commemoration of the martyrdom of Husayn ibn Ali. Karbala receives "
        "millions of pilgrims; processions and ta'ziya passion plays run "
        "through the first ten days of Muharram."
    ),
    "Mawlid al-Nabi": "Observance of the Prophet's birth, marked by processions and recitation.",
    "Start of Ramadan": "First day of the fasting month, set by local crescent sighting.",
    "Laylat al-Qadr (27 Ramadan)": "The Night of Decree — mosques fill for night-long prayer.",
    "Eid al-Fitr": "Festival of breaking the fast: communal dawn prayer, then three days of feasting.",
    "Day of Arafah": "Pilgrims stand in prayer on the plain of Arafat, the culminating rite of Hajj.",
    "Eid al-Adha": "Festival of sacrifice, coinciding with the final days of Hajj.",
}


def _islamic_events(gregorian_years: list[int]) -> list[PhenomenonEvent]:
    events: list[PhenomenonEvent] = []
    seen: set[str] = set()
    span_years = set(gregorian_years)

    for gy in gregorian_years:
        for hy in hijri_years_overlapping(gy):
            for name, month, day, span, emoji in ISLAMIC_OBSERVANCES:
                gdate = islamic_festival(hy, month, day)
                if gdate.year not in span_years:
                    continue
                ident = stable_id("cal-islamic", name, hy)
                if ident in seen:
                    continue
                seen.add(ident)

                site, lat, lon, country = ISLAMIC_ANCHORS[name]
                start = datetime(gdate.year, gdate.month, gdate.day, tzinfo=timezone.utc)
                events.append(
                    PhenomenonEvent(
                        id=ident,
                        name=f"{name} ({hy} AH)",
                        description=ISLAMIC_BLURB[name],
                        category=Category.RITUAL,
                        tier=Tier.DETERMINISTIC,
                        lat=lat,
                        lon=lon,
                        location_hint=site,
                        country=country,
                        # Tabular reckoning; local sighting moves this a day either way.
                        window_start=start - timedelta(days=1),
                        window_end=start + timedelta(days=span),
                        peak=start,
                        uncertainty_days=1.5,
                        base_confidence=0.90,
                        sources=[
                            _calendar_source(
                                "Tabular Islamic calendar; regional moon sighting "
                                "shifts observance by up to a day."
                            )
                        ],
                        last_verified_at=utcnow(),
                        emoji=emoji,
                        recurrence="annual, Hijri",
                    )
                )
    return events


def _lunisolar_events(years: list[int]) -> list[PhenomenonEvent]:
    events: list[PhenomenonEvent] = []

    for year in years:
        cny = chinese_new_year(year)
        start = datetime(cny.year, cny.month, cny.day, tzinfo=timezone.utc)
        events.append(
            PhenomenonEvent(
                id=stable_id("cal-cny", year),
                name="Lunar New Year",
                description=(
                    "The largest annual human migration on Earth. Fifteen days "
                    "of observance closing with the Lantern Festival."
                ),
                category=Category.RITUAL,
                tier=Tier.DETERMINISTIC,
                lat=39.9042,
                lon=116.4074,
                location_hint="Beijing (observed across East and Southeast Asia)",
                country="China",
                window_start=start - timedelta(days=1),
                window_end=start + timedelta(days=15),
                peak=start,
                uncertainty_days=0.0,
                base_confidence=1.0,
                sources=[MEEUS, _calendar_source("Second new moon after the December solstice.")],
                last_verified_at=utcnow(),
                emoji="🏮",
                recurrence="annual, lunisolar",
            )
        )

        dwl = diwali(year)
        dstart = datetime(dwl.year, dwl.month, dwl.day, tzinfo=timezone.utc)
        events.append(
            PhenomenonEvent(
                id=stable_id("cal-diwali", year),
                name="Diwali (Lakshmi Puja)",
                description=(
                    "The Kartika new moon. Varanasi's ghats and the Ayodhya "
                    "riverbank carry hundreds of thousands of oil lamps."
                ),
                category=Category.RITUAL,
                tier=Tier.DETERMINISTIC,
                lat=25.3176,
                lon=82.9739,
                location_hint="Varanasi (observed across South Asia)",
                country="India",
                window_start=dstart - timedelta(days=2),
                window_end=dstart + timedelta(days=3),
                peak=dstart,
                # Regional almanacs put Lakshmi Puja a day either side.
                uncertainty_days=1.0,
                base_confidence=0.95,
                sources=[MEEUS, _calendar_source("Amavasya of Kartika.")],
                last_verified_at=utcnow(),
                emoji="🪔",
                recurrence="annual, lunisolar",
            )
        )

        # Purnima observances pinned to a specific month's full moon.
        for month, name, blurb, lat, lon, hint, country, emoji in [
            (5, "Vesak (Buddha Purnima)",
             "Buddha's birth, enlightenment and death observed on one full moon; "
             "Borobudur fills with monks and lantern releases.",
             -7.6079, 110.2038, "Borobudur", "Indonesia", "🏮"),
            (11, "Kartik Purnima / Dev Deepawali",
             "A million lamps down the Varanasi ghats on the full moon of Kartika.",
             25.3176, 82.9739, "Varanasi", "India", "🪔"),
        ]:
            fm = full_moon_festival(year, month)
            if not fm:
                continue
            fstart = datetime(fm.year, fm.month, fm.day, tzinfo=timezone.utc)
            events.append(
                PhenomenonEvent(
                    id=stable_id("cal-purnima", name, year),
                    name=name,
                    description=blurb,
                    category=Category.RITUAL,
                    tier=Tier.DETERMINISTIC,
                    lat=lat,
                    lon=lon,
                    location_hint=hint,
                    country=country,
                    window_start=fstart - timedelta(days=1),
                    window_end=fstart + timedelta(days=1),
                    peak=fstart,
                    uncertainty_days=1.0,
                    base_confidence=0.95,
                    sources=[MEEUS],
                    last_verified_at=utcnow(),
                    emoji=emoji,
                    recurrence="annual, lunisolar",
                )
            )

    return events


def fetch(years: list[int] | None = None) -> list[PhenomenonEvent]:
    """Every deterministic event for the requested years."""
    if years is None:
        this_year = utcnow().year
        years = [this_year, this_year + 1]

    return (
        solar_alignments(years)
        + meteor_showers(years)
        + _islamic_events(years)
        + _lunisolar_events(years)
    )
