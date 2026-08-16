"""Tier 2 — published scientific model output.

Two live feeds, both free and keyless:

  NOAA SWPC OVATION   gridded auroral probability, refreshed every few minutes,
                      plus the 3-day planetary K-index forecast
  Open-Meteo          temperature series driving a growing-degree-day bloom
                      model, which generalizes to any site with a fitted
                      threshold — the trick that makes blooms predictable
                      outside the US, where USA-NPN does not reach

USA-NPN is wired up too but could not be reached when this was written; it
fails soft and contributes nothing until it answers.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from ..http import get_json
from ..schema import (
    Category,
    PhenomenonEvent,
    Precision,
    SourceKind,
    SourceRef,
    Tier,
    stable_id,
    utcnow,
)

log = logging.getLogger(__name__)

REGISTRY = Path(__file__).resolve().parent.parent / "registry"

OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
KP_FORECAST_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
USANPN_OBSERVATIONS = "https://services.usanpn.org/npn_portal/observations/getObservations.json"


# ── aurora ────────────────────────────────────────────────────────────────

# Places where an aurora forecast turns into someone booking a flight.
AURORA_SITES = [
    ("Tromso", 69.6492, 18.9553, "Norway"),
    ("Abisko", 68.3494, 18.8303, "Sweden"),
    ("Rovaniemi", 66.5039, 25.7294, "Finland"),
    ("Reykjavik", 64.1466, -21.9426, "Iceland"),
    ("Fairbanks", 64.8378, -147.7164, "United States"),
    ("Yellowknife", 62.4540, -114.3718, "Canada"),
    ("Murmansk", 68.9585, 33.0827, "Russia"),
    ("Invercargill", -46.4132, 168.3538, "New Zealand"),
    ("Hobart", -42.8821, 147.3272, "Australia"),
    ("Ushuaia", -54.8019, -68.3030, "Argentina"),
]

# Below this the aurora is real but not worth telling anyone about.
AURORA_MIN_PROBABILITY = 8


def _ovation_lookup(grid: list[list[int]]) -> dict[tuple[int, int], int]:
    """Index the OVATION grid by (lon, lat) — it ships as a flat triple list."""
    return {(int(lon), int(lat)): int(prob) for lon, lat, prob in grid}


def _site_probability(index: dict[tuple[int, int], int], lat: float, lon: float) -> int:
    """Best probability within a couple of degrees of the site."""
    lon_360 = int(round(lon % 360))
    lat_r = int(round(lat))
    best = 0
    for dlon in (-2, -1, 0, 1, 2):
        for dlat in (-2, -1, 0, 1, 2):
            probe = ((lon_360 + dlon) % 360, lat_r + dlat)
            best = max(best, index.get(probe, 0))
    return best


def _kp_outlook() -> tuple[Optional[float], Optional[datetime]]:
    """Peak forecast Kp over the next three days, and when it lands."""
    data = get_json(KP_FORECAST_URL)
    if not isinstance(data, list) or not data:
        return None, None

    peak_kp, peak_at = None, None
    now = utcnow()
    for row in data:
        # The product mixes observed history with the forward forecast.
        if isinstance(row, dict):
            tag, kp, observed = row.get("time_tag"), row.get("kp"), row.get("observed")
        elif isinstance(row, list) and len(row) >= 3:
            tag, kp, observed = row[0], row[1], row[2]
        else:
            continue
        if observed == "observed":
            continue
        try:
            when = datetime.fromisoformat(str(tag).replace("Z", "")).replace(tzinfo=timezone.utc)
            value = float(kp)
        except (TypeError, ValueError):
            continue
        if when < now:
            continue
        if peak_kp is None or value > peak_kp:
            peak_kp, peak_at = value, when
    return peak_kp, peak_at


def aurora() -> list[PhenomenonEvent]:
    payload = get_json(OVATION_URL, timeout=45)
    if not payload or "coordinates" not in payload:
        log.warning("aurora: OVATION unavailable, skipping layer")
        return []

    observed_at = payload.get("Observation Time")
    forecast_at = payload.get("Forecast Time")
    try:
        verified = datetime.fromisoformat(str(observed_at).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        verified = utcnow()

    index = _ovation_lookup(payload["coordinates"])
    peak_kp, peak_at = _kp_outlook()

    source = SourceRef(
        name="NOAA SWPC OVATION Aurora Model",
        url=OVATION_URL,
        kind=SourceKind.MODEL,
        retrieved_at=utcnow(),
        note=f"30-minute nowcast; forecast time {forecast_at}.",
    )
    sources = [source]
    if peak_kp is not None:
        sources.append(
            SourceRef(
                name="NOAA SWPC Planetary K-index Forecast",
                url=KP_FORECAST_URL,
                kind=SourceKind.MODEL,
                retrieved_at=utcnow(),
                note=f"3-day outlook, peak Kp {peak_kp:g}.",
            )
        )

    now = utcnow()
    events: list[PhenomenonEvent] = []

    for site, lat, lon, country in AURORA_SITES:
        probability = _site_probability(index, lat, lon)
        if probability < AURORA_MIN_PROBABILITY:
            continue

        kp_line = ""
        if peak_kp is not None and peak_at is not None:
            kp_line = (
                f" Planetary Kp is forecast to peak near {peak_kp:g} "
                f"on {peak_at:%d %b %H:%M} UTC."
            )

        events.append(
            PhenomenonEvent(
                id=stable_id("aurora", site, now.strftime("%Y-%m-%d")),
                name=f"Aurora over {site}",
                description=(
                    f"OVATION puts auroral visibility at {probability}% overhead "
                    f"tonight.{kp_line} Clear skies and darkness still decide it."
                ),
                category=Category.ATMOSPHERIC,
                tier=Tier.MODEL,
                lat=lat,
                lon=lon,
                location_hint=site,
                country=country,
                # The nowcast covers the coming night; Kp extends the outlook.
                window_start=now,
                window_end=now + timedelta(days=1 if peak_kp is None else 3),
                peak=peak_at,
                uncertainty_days=0.5,
                # The model's own probability is the honest base confidence.
                base_confidence=min(0.95, probability / 100 + 0.25),
                sources=sources,
                last_verified_at=verified,
                emoji="🌌",
                recurrence="solar-driven, episodic",
            )
        )

    return events


# ── growing-degree-day bloom model ────────────────────────────────────────

def _load_bloom_models() -> list[dict[str, Any]]:
    path = REGISTRY / "bloom_models.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))["models"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        log.warning("bloom registry unreadable: %s", exc)
        return []


def _season_start(season_start: str, today: date) -> date:
    """Resolve an MM-DD season anchor to the most recent occurrence."""
    month, day = (int(p) for p in season_start.split("-"))
    candidate = date(today.year, month, day)
    if candidate > today:
        candidate = date(today.year - 1, month, day)
    return candidate


def _daily_temps(lat: float, lon: float, start: date, end: date) -> dict[str, tuple[float, float]]:
    """Daily (tmin, tmax) from Open-Meteo, stitching archive to forecast.

    The archive runs about five days behind, so the forecast endpoint covers
    the recent past and the two weeks ahead.
    """
    series: dict[str, tuple[float, float]] = {}
    today = datetime.now(timezone.utc).date()
    archive_end = min(end, today - timedelta(days=6))

    def absorb(payload: Optional[dict]) -> None:
        if not payload or "daily" not in payload:
            return
        daily = payload["daily"]
        for iso_day, tmax, tmin in zip(
            daily.get("time", []),
            daily.get("temperature_2m_max", []),
            daily.get("temperature_2m_min", []),
        ):
            if tmax is None or tmin is None:
                continue
            series[iso_day] = (float(tmin), float(tmax))

    if archive_end > start:
        absorb(
            get_json(
                OPEN_METEO_ARCHIVE,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": start.isoformat(),
                    "end_date": archive_end.isoformat(),
                    "daily": "temperature_2m_max,temperature_2m_min",
                    "timezone": "UTC",
                },
                timeout=45,
            )
        )

    absorb(
        get_json(
            OPEN_METEO_FORECAST,
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
                "past_days": 10,
                "forecast_days": 16,
                "timezone": "UTC",
            },
            timeout=45,
        )
    )

    return series


def _accumulate_gdd(
    series: dict[str, tuple[float, float]], base_temp: float, start: date
) -> tuple[float, Optional[date], list[tuple[date, float]]]:
    """Sum degree-days from the season anchor.

    Returns the total, the date the threshold-crossing search should start
    from, and the per-day accumulation trail.
    """
    trail: list[tuple[date, float]] = []
    total = 0.0
    for iso_day in sorted(series):
        day = date.fromisoformat(iso_day)
        if day < start:
            continue
        tmin, tmax = series[iso_day]
        total += max(0.0, (tmin + tmax) / 2.0 - base_temp)
        trail.append((day, total))
    first = trail[0][0] if trail else None
    return total, first, trail


def _project_crossing(
    trail: list[tuple[date, float]], threshold: float
) -> tuple[Optional[date], bool, float]:
    """Find when accumulated GDD crosses the threshold.

    Returns (crossing date, whether it already happened, days projected past
    the end of real data — which is what drives the uncertainty band).
    """
    for day, total in trail:
        if total >= threshold:
            return day, True, 0.0

    if len(trail) < 8:
        return None, False, 0.0

    # Extrapolate at the trailing 7-day accrual rate.
    last_day, last_total = trail[-1]
    week_ago_total = trail[-8][1]
    rate = (last_total - week_ago_total) / 7.0
    if rate <= 0.1:
        return None, False, 0.0

    days_out = (threshold - last_total) / rate
    if days_out > 120:
        return None, False, 0.0
    return last_day + timedelta(days=round(days_out)), False, days_out


def blooms() -> list[PhenomenonEvent]:
    models = _load_bloom_models()
    if not models:
        return []

    today = datetime.now(timezone.utc).date()
    events: list[PhenomenonEvent] = []

    for model in models:
        start = _season_start(model["seasonStart"], today)
        series = _daily_temps(model["lat"], model["lon"], start, today + timedelta(days=16))
        if not series:
            log.warning("bloom %s: no temperature data", model["id"])
            continue

        total, _, trail = _accumulate_gdd(series, model["baseTempC"], start)
        threshold = float(model["gddThreshold"])
        crossing, already, days_out = _project_crossing(trail, threshold)
        if crossing is None:
            continue

        duration = int(model["bloomDurationDays"])
        bloom_start = datetime(crossing.year, crossing.month, crossing.day, tzinfo=timezone.utc)
        bloom_end = bloom_start + timedelta(days=duration)

        # This season's bloom is over. Projecting next season from a heat sum
        # that has not started accumulating would be fiction, so say nothing.
        if bloom_end < utcnow():
            log.info("bloom %s: season closed %s", model["id"], bloom_end.date())
            continue

        # An observed crossing is far more trustworthy than a projected one,
        # and a projection degrades the further out it reaches.
        if already:
            uncertainty = 3.0
            base = 0.72
        else:
            uncertainty = min(21.0, 3.0 + days_out * 0.35)
            base = max(0.30, 0.68 - days_out * 0.012)

        # An unfitted threshold is a guess wearing a number's clothing.
        if model.get("calibrationStatus") != "fitted":
            base *= 0.8

        progress = min(100, round(total / threshold * 100))
        underway = bloom_start <= utcnow() <= bloom_end
        if underway:
            phase = f"Heat sum reached — bloom underway ({progress}% of threshold accumulated)."
        elif already:
            phase = (
                f"Heat sum reached; bloom expected to open around "
                f"{bloom_start:%d %b} ({progress}% accumulated)."
            )
        else:
            phase = (
                f"{progress}% of the heat sum accumulated; "
                f"projected to cross in about {round(days_out)} days."
            )

        events.append(
            PhenomenonEvent(
                id=stable_id("bloom", model["id"], crossing.isoformat()),
                name=model["name"],
                description=(
                    f"{model['species']}. {phase} "
                    f"Growing-degree-day model, base {model['baseTempC']}C "
                    f"from {model['seasonStart']}."
                ),
                category=Category.FLORA,
                tier=Tier.MODEL,
                lat=model["lat"],
                lon=model["lon"],
                location_hint=model["locationHint"],
                country=model["country"],
                window_start=bloom_start,
                window_end=bloom_end,
                peak=bloom_start + timedelta(days=duration // 3),
                uncertainty_days=uncertainty,
                base_confidence=base,
                sources=[
                    SourceRef(
                        name="Open-Meteo temperature series",
                        url=OPEN_METEO_FORECAST,
                        kind=SourceKind.MODEL,
                        retrieved_at=utcnow(),
                        note=(
                            f"GDD base {model['baseTempC']}C, threshold {threshold:g}, "
                            f"accumulated {total:.0f}."
                        ),
                    ),
                    SourceRef(
                        name=f"Bloom model calibration ({model.get('calibrationStatus','unknown')})",
                        url="pipeline/registry/bloom_models.json",
                        kind=SourceKind.MODEL,
                        retrieved_at=utcnow(),
                        note=model.get("calibratedFrom", ""),
                    ),
                ],
                last_verified_at=utcnow(),
                emoji=model.get("emoji", "🌸"),
                recurrence="annual, temperature-driven",
            )
        )

    return events


# ── USA-NPN (unverified upstream) ─────────────────────────────────────────

def usanpn(species_id: int = 3, phenophase_id: int = 501, days: int = 21) -> list[PhenomenonEvent]:
    """USA-NPN phenology observations, aggregated to a regional signal.

    Left in place and wired, but the endpoint did not respond when this was
    written, so it contributes nothing until it does. No API key is required —
    USA-NPN asks only that callers identify themselves via request_src.
    """
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    payload = get_json(
        USANPN_OBSERVATIONS,
        params={
            "request_src": "kairosphere",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "species_id[0]": species_id,
            "phenophase_id[0]": phenophase_id,
        },
        timeout=45,
    )
    if not isinstance(payload, list) or not payload:
        return []

    positives = [
        row for row in payload
        if isinstance(row, dict) and str(row.get("phenophase_status")) == "1"
    ]
    if len(positives) < 5:
        return []

    lat = sum(float(r["latitude"]) for r in positives) / len(positives)
    lon = sum(float(r["longitude"]) for r in positives) / len(positives)

    return [
        PhenomenonEvent(
            id=stable_id("npn", species_id, phenophase_id, end.isoformat()),
            name="USA-NPN phenology signal",
            description=(
                f"{len(positives)} positive phenophase reports in the last "
                f"{days} days across the observer network."
            ),
            category=Category.FLORA,
            tier=Tier.MODEL,
            lat=lat,
            lon=lon,
            location_hint="USA-NPN observer network",
            country="United States",
            window_start=utcnow() - timedelta(days=3),
            window_end=utcnow() + timedelta(days=14),
            uncertainty_days=7.0,
            base_confidence=0.6,
            sources=[
                SourceRef(
                    name="USA National Phenology Network",
                    url=USANPN_OBSERVATIONS,
                    kind=SourceKind.MODEL,
                    retrieved_at=utcnow(),
                )
            ],
            last_verified_at=utcnow(),
            emoji="🌱",
            precision=Precision.REGIONAL,
        )
    ]


def fetch() -> list[PhenomenonEvent]:
    return aurora() + blooms() + usanpn()
