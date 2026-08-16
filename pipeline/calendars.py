"""Lunisolar calendar conversion for calculable religious festivals.

A large slice of the ritual catalogue is arithmetic, not forecasting: Ashura is
10 Muharram, Chinese New Year is the second new moon after the December
solstice, Diwali is the Kartika new moon. Those fall out of the calendar with
no data source at all.

The honest caveat, encoded as uncertainty rather than hidden: Islamic dates
depend on local crescent sighting and shift by up to a day or two by region,
and Hindu observance varies by regional almanac.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from .astro import phases_in_range, solar_event

CST = timezone(timedelta(hours=8))  # China Standard Time, which fixes CNY's date
IST = timezone(timedelta(hours=5, minutes=30))  # India, for tithi day attribution


# ── Islamic (tabular civil calendar, Kuwaiti algorithm) ───────────────────

def islamic_to_jdn(year: int, month: int, day: int) -> int:
    """Hijri date -> Julian Day Number, tabular civil reckoning."""
    return (
        day
        + (29 * (month - 1))
        + (month // 2)
        + (354 * (year - 1))
        + ((3 + (11 * year)) // 30)
        + 1948439
        - 1
    )


def jdn_to_gregorian(jdn: int) -> date:
    a = jdn + 32044
    b = (4 * a + 3) // 146097
    c = a - (146097 * b) // 4
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    day = e - (153 * m + 2) // 5 + 1
    month = m + 3 - 12 * (m // 10)
    year = 100 * b + d - 4800 + (m // 10)
    return date(year, month, day)


def islamic_festival(hijri_year: int, month: int, day: int) -> date:
    """Gregorian date of a fixed Hijri date, tabular reckoning."""
    return jdn_to_gregorian(islamic_to_jdn(hijri_year, month, day))


def hijri_years_overlapping(gregorian_year: int) -> list[int]:
    """Hijri years whose months touch the given Gregorian year."""
    approx = int((gregorian_year - 622) * 33 / 32)
    return [approx - 1, approx, approx + 1]


# Fixed points in the Hijri calendar worth putting on a map.
ISLAMIC_OBSERVANCES = [
    # (name, month, day, span_days, emoji)
    ("Ashura", 1, 10, 1, "🕯️"),
    ("Mawlid al-Nabi", 3, 12, 1, "🕌"),
    ("Start of Ramadan", 9, 1, 1, "🌙"),
    ("Laylat al-Qadr (27 Ramadan)", 9, 27, 1, "✨"),
    ("Eid al-Fitr", 10, 1, 3, "🎉"),
    ("Day of Arafah", 12, 9, 1, "🕋"),
    ("Eid al-Adha", 12, 10, 4, "🕋"),
]


# ── Chinese New Year (second new moon after the December solstice) ────────

def chinese_new_year(year: int) -> date:
    """Lunar New Year, resolved in China Standard Time.

    The rule: the first day of the lunar month containing no major solar term
    is intercalary, which in practice makes CNY the second new moon following
    the preceding December solstice (an exception near a leap month shifts it
    to the third, which this rule does not model).
    """
    solstice = solar_event(year - 1, "december_solstice")
    window_end = datetime(year, 3, 15, tzinfo=timezone.utc)
    new_moons = phases_in_range(solstice, window_end, "new")
    if len(new_moons) < 2:
        raise RuntimeError(f"could not resolve Chinese New Year for {year}")
    return new_moons[1].astimezone(CST).date()


# ── Diwali (Kartika amavasya) ─────────────────────────────────────────────

def diwali(year: int) -> date:
    """Lakshmi Puja night — the new moon of the Kartika month.

    Approximated as the new moon falling between mid-October and mid-November,
    which matches published dates; regional almanacs still vary by a day.
    """
    start = datetime(year, 10, 12, tzinfo=timezone.utc)
    end = datetime(year, 11, 16, tzinfo=timezone.utc)
    moons = phases_in_range(start, end, "new")
    if not moons:
        raise RuntimeError(f"could not resolve Diwali for {year}")
    return moons[0].astimezone(IST).date()


# ── Hindu/Buddhist full-moon observances ──────────────────────────────────

def full_moon_festival(year: int, month: int) -> date | None:
    """The full moon of a given Gregorian month, in IST.

    Used for observances pinned to a purnima — Vesak (May), Guru Purnima
    (July), Kartik Purnima (November).
    """
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = (start.replace(day=28) + timedelta(days=8)).replace(day=1)
    moons = phases_in_range(start, end, "full")
    if not moons:
        return None
    return moons[0].astimezone(IST).date()
