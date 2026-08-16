"""Astronomical math, no dependencies and no network.

Implements the standard Meeus algorithms (*Astronomical Algorithms*, 2nd ed.)
for the two things this app needs:

  * equinoxes and solstices  (ch. 27)
  * new and full moons       (ch. 49)

Accuracy is well under a minute for the modern era, against day-level windows,
so the truncated planetary terms Meeus lists as optional are omitted.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

J2000 = 2451545.0


def _rad(deg: float) -> float:
    return math.radians(deg % 360.0)


def jd_to_datetime(jd: float) -> datetime:
    """Julian Day -> UTC datetime (Fliegel-Van Flandern, via Meeus ch. 7)."""
    jd = jd + 0.5
    z = int(jd)
    f = jd - z

    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - int(alpha / 4)

    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)

    day = b - d - int(30.6001 * e) + f
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715

    day_int = int(day)
    frac = day - day_int
    seconds = round(frac * 86400.0)

    return datetime(year, month, day_int, tzinfo=timezone.utc) + timedelta(seconds=seconds)


def delta_t_seconds(year: float) -> float:
    """TT - UT1 estimate. NASA polynomial for 2005-2050."""
    t = year - 2000.0
    return 62.92 + 0.32217 * t + 0.005589 * t * t


def _tt_to_utc(jde: float, year: float) -> datetime:
    """Meeus returns Dynamical Time; shift to UTC before publishing."""
    return jd_to_datetime(jde) - timedelta(seconds=delta_t_seconds(year))


# ── equinoxes and solstices (Meeus ch. 27) ────────────────────────────────

# Mean-event coefficients for years 1000-3000.
_MEAN_TERMS = {
    "march_equinox":     (2451623.80984, 365242.37404,  0.05169, -0.00411, -0.00057),
    "june_solstice":     (2451716.56767, 365241.62603,  0.00325,  0.00888, -0.00030),
    "september_equinox": (2451810.21715, 365242.01767, -0.11575,  0.00337,  0.00078),
    "december_solstice": (2451900.05952, 365242.74049, -0.06223, -0.00823,  0.00032),
}

# Periodic correction terms (A, B, C) from Meeus table 27.C.
_PERIODIC = [
    (485, 324.96, 1934.136), (203, 337.23, 32964.467), (199, 342.08, 20.186),
    (182, 27.85, 445267.112), (156, 73.14, 45036.886), (136, 171.52, 22518.443),
    (77, 222.54, 65928.934), (74, 296.72, 3034.906), (70, 243.58, 9037.513),
    (58, 119.81, 33718.147), (52, 297.17, 150.678), (50, 21.02, 2281.226),
    (45, 247.54, 29929.562), (44, 325.15, 31555.956), (29, 60.93, 4443.417),
    (18, 155.12, 67555.328), (17, 288.79, 4562.452), (16, 198.04, 62894.029),
    (14, 199.76, 31436.921), (12, 95.39, 14577.848), (12, 287.11, 31931.756),
    (12, 320.81, 34777.259), (9, 227.73, 1222.114), (8, 15.45, 16859.074),
]


def solar_event(year: int, which: str) -> datetime:
    """UTC instant of an equinox or solstice.

    `which` is one of march_equinox, june_solstice, september_equinox,
    december_solstice.
    """
    if which not in _MEAN_TERMS:
        raise ValueError(f"unknown solar event: {which}")

    a, b, c, d, e = _MEAN_TERMS[which]
    y = (year - 2000) / 1000.0
    jde0 = a + b * y + c * y**2 + d * y**3 + e * y**4

    t = (jde0 - J2000) / 36525.0
    w = _rad(35999.373 * t - 2.47)
    delta_lambda = 1 + 0.0334 * math.cos(w) + 0.0007 * math.cos(2 * w)
    s = sum(amp * math.cos(_rad(bb + cc * t)) for amp, bb, cc in _PERIODIC)

    jde = jde0 + (0.00001 * s) / delta_lambda
    return _tt_to_utc(jde, year)


def solar_events(year: int) -> dict[str, datetime]:
    return {name: solar_event(year, name) for name in _MEAN_TERMS}


# ── lunar phases (Meeus ch. 49) ───────────────────────────────────────────

# (coefficient, argument) where argument is a tuple of multiples of
# (M', M, F, Omega) and the flag says which power of E scales the term.
_PHASE_TERMS_NEW = [
    (-0.40720, (1, 0, 0, 0), 0), (0.17241, (0, 1, 0, 0), 1),
    (0.01608, (2, 0, 0, 0), 0), (0.01039, (0, 0, 2, 0), 0),
    (0.00739, (1, -1, 0, 0), 1), (-0.00514, (1, 1, 0, 0), 1),
    (0.00208, (0, 2, 0, 0), 2), (-0.00111, (1, 0, -2, 0), 0),
    (-0.00057, (1, 0, 2, 0), 0), (0.00056, (2, 1, 0, 0), 1),
    (-0.00042, (3, 0, 0, 0), 0), (0.00042, (0, 1, 2, 0), 1),
    (0.00038, (0, 1, -2, 0), 1), (-0.00024, (2, -1, 0, 0), 1),
    (-0.00017, (0, 0, 0, 1), 0), (-0.00007, (1, 2, 0, 0), 0),
    (0.00004, (2, 0, -2, 0), 0), (0.00004, (0, 3, 0, 0), 0),
    (0.00003, (1, 1, -2, 0), 0), (0.00003, (2, 0, 2, 0), 0),
    (-0.00003, (1, 1, 2, 0), 0), (0.00003, (1, -1, 2, 0), 0),
    (-0.00002, (1, -1, -2, 0), 0), (-0.00002, (3, 1, 0, 0), 0),
    (0.00002, (4, 0, 0, 0), 0),
]

# Full moon shares the argument table; only the leading coefficients differ.
_FULL_OVERRIDES = {
    0: -0.40614, 1: 0.17302, 2: 0.01614, 3: 0.01043,
    4: 0.00734, 5: -0.00515, 6: 0.00209,
}


def _phase_k(year: float, phase: str) -> float:
    offset = {"new": 0.0, "full": 0.5}[phase]
    approx = (year - 2000.0) * 12.3685
    return math.floor(approx - offset) + offset


def lunar_phase(k: float, phase: str) -> datetime:
    """UTC instant of the new or full moon identified by lunation number k."""
    t = k / 1236.85
    jde = (
        2451550.09766
        + 29.530588861 * k
        + 0.00015437 * t**2
        - 0.000000150 * t**3
        + 0.00000000073 * t**4
    )

    e = 1 - 0.002516 * t - 0.0000074 * t**2
    m = 2.5534 + 29.10535670 * k - 0.0000014 * t**2 - 0.00000011 * t**3
    mp = (
        201.5643 + 385.81693528 * k + 0.0107582 * t**2
        + 0.00001238 * t**3 - 0.000000058 * t**4
    )
    f = (
        160.7108 + 390.67050284 * k - 0.0016118 * t**2
        - 0.00000227 * t**3 + 0.000000011 * t**4
    )
    omega = 124.7746 - 1.56375588 * k + 0.0020672 * t**2 + 0.00000215 * t**3

    correction = 0.0
    for idx, (coeff, (n_mp, n_m, n_f, n_om), e_power) in enumerate(_PHASE_TERMS_NEW):
        if phase == "full" and idx in _FULL_OVERRIDES:
            coeff = _FULL_OVERRIDES[idx]
        angle = n_mp * mp + n_m * m + n_f * f + n_om * omega
        correction += coeff * (e**e_power) * math.sin(_rad(angle))

    year = 2000.0 + k / 12.3685
    return _tt_to_utc(jde + correction, year)


def phases_in_range(start: datetime, end: datetime, phase: str) -> list[datetime]:
    """Every new or full moon between two instants."""
    year_start = start.year + (start.timetuple().tm_yday / 365.25)
    k = _phase_k(year_start, phase) - 2

    out: list[datetime] = []
    while True:
        moment = lunar_phase(k, phase)
        if moment > end:
            break
        if moment >= start:
            out.append(moment)
        k += 1
        if len(out) > 500:  # guard against a malformed range
            break
    return out


def moon_illumination_fraction(when: datetime) -> float:
    """Rough illuminated fraction, for dark-sky quality scoring.

    Phase angle from the mean elongation is enough to tell a new moon from a
    gibbous one, which is all the viewing-conditions score needs.
    """
    jd = (when - datetime(2000, 1, 1, 12, tzinfo=timezone.utc)).total_seconds() / 86400.0 + J2000
    t = (jd - J2000) / 36525.0
    d = _rad(297.8501921 + 445267.1114034 * t)  # mean elongation
    m = _rad(357.5291092 + 35999.0502909 * t)   # sun mean anomaly
    mp = _rad(134.9633964 + 477198.8675055 * t) # moon mean anomaly

    # Phase angle series truncated to the dominant terms (Meeus ch. 48).
    i = (
        180.0
        - math.degrees(d)
        - 6.289 * math.sin(mp)
        + 2.100 * math.sin(m)
        - 1.274 * math.sin(2 * math.radians(math.degrees(d)) - mp)
        - 0.658 * math.sin(2 * math.radians(math.degrees(d)))
        - 0.214 * math.sin(2 * mp)
        - 0.110 * math.sin(d)
    )
    return (1 + math.cos(_rad(i))) / 2
