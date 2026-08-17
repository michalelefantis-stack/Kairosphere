"""Which airport do you fly into, and how far is it from the event?

Every flight search asks you where you are going. For most of this
catalogue that is not a question with an obvious answer: the Naghol towers
are on Pentecost Island, Gerewol happens in the Sahel a long way from
anything with a runway, and nobody knows the IATA code for Sumba off the
top of their head. That gap is where trips die — not at the price, at the
"I don't know how you'd even get there".

Google Flights cannot answer it because it does not know these events
exist. This does, so it resolves the airports once, up front:

    python -m pipeline.airports                 # everything missing
    python -m pipeline.airports --refresh       # recompute all

Writes public/data/event_airports.json, which the app can read offline.

Two airports are recorded per event, because one is not enough:

    arrival   the nearest airport with an IATA code, however small — the
              airstrip you actually land on
    gateway   the nearest airport that takes scheduled service and is big
              enough to reach from abroad

For Naghol those are different places and the difference is the trip: you
fly into Port Vila and then you find a light aircraft. Showing only the
nearest strip implies a directness that does not exist; showing only the
international hub hides a 190km leg.

Source: OurAirports (https://ourairports.com/data/), public domain.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
import math
import re
import sys
from pathlib import Path

import requests

log = logging.getLogger("airports")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "event_airports.json"
CATALOGUE = [ROOT / "mockData.ts", ROOT / "data" / "southeastAsia.ts"]
CACHE = ROOT / "pipeline" / "cache" / "airports.csv"

SOURCE = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Types that can actually be flown into on a ticket. Heliports, seaplane
# bases and closed fields are excluded: they have codes and no use here.
ARRIVAL_TYPES = {"large_airport", "medium_airport", "small_airport"}
GATEWAY_TYPES = {"large_airport", "medium_airport"}

EARTH_KM = 6371.0088


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def load_airports() -> list[dict]:
    """OurAirports, cached on disk so a rerun costs nothing."""
    if CACHE.exists():
        text = CACHE.read_text(encoding="utf-8", errors="replace")
    else:
        log.info("fetching %s", SOURCE)
        response = requests.get(SOURCE, timeout=90)
        response.raise_for_status()
        text = response.text
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(text, encoding="utf-8")

    airports = []
    for row in csv.DictReader(io.StringIO(text)):
        iata = (row.get("iata_code") or "").strip().upper()
        kind = (row.get("type") or "").strip()
        if len(iata) != 3 or kind not in ARRIVAL_TYPES:
            continue
        try:
            lat = float(row["latitude_deg"])
            lon = float(row["longitude_deg"])
        except (TypeError, ValueError, KeyError):
            continue
        airports.append({
            "iata": iata,
            "name": (row.get("name") or "").strip(),
            "municipality": (row.get("municipality") or "").strip(),
            "country": (row.get("iso_country") or "").strip(),
            "type": kind,
            "scheduled": (row.get("scheduled_service") or "").strip() == "yes",
            "lat": lat,
            "lon": lon,
        })
    return airports


FIELD = re.compile(r"(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")")
COORDS = re.compile(r"coordinates:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]")


def load_events() -> list[dict]:
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace")
                     for p in CATALOGUE if p.exists())
    events = []
    for blob in re.split(r"\n\s*\{\s*\n?", text):
        fields = {}
        for m in FIELD.finditer(blob):
            fields[m.group(1)] = m.group(2) if m.group(2) is not None else (m.group(3) or "")
        coords = COORDS.search(blob)
        if "id" in fields and coords:
            events.append({
                "id": fields["id"],
                "title": re.sub(r"\\(.)", r"\1", fields.get("title", "")),
                "lat": float(coords.group(1)),
                "lon": float(coords.group(2)),
            })
    return events


def describe(airport: dict, km: float) -> dict:
    return {
        "iata": airport["iata"],
        "name": airport["name"],
        "place": airport["municipality"] or airport["country"],
        "km": round(km, 1),
        "type": airport["type"],
    }


def nearest(event: dict, airports: list[dict]) -> dict | None:
    """Arrival strip and international gateway for one event."""
    best_arrival = best_arrival_km = None
    best_gateway = best_gateway_km = None

    for airport in airports:
        km = haversine(event["lat"], event["lon"], airport["lat"], airport["lon"])

        if best_arrival_km is None or km < best_arrival_km:
            best_arrival, best_arrival_km = airport, km

        # A gateway has to be reachable on a normal ticket, which means
        # scheduled service — a medium airport nobody flies to is not a way in.
        if airport["type"] in GATEWAY_TYPES and airport["scheduled"]:
            if best_gateway_km is None or km < best_gateway_km:
                best_gateway, best_gateway_km = airport, km

    if not best_arrival:
        return None

    result = {"arrival": describe(best_arrival, best_arrival_km)}
    # Only worth naming a gateway when it is a different airport.
    if best_gateway and best_gateway["iata"] != best_arrival["iata"]:
        result["gateway"] = describe(best_gateway, best_gateway_km)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true",
                        help="recompute events that already have an airport")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    airports = load_airports()
    events = load_events()
    log.info("%d airports with IATA codes, %d events with coordinates",
             len(airports), len(events))

    existing = {}
    if OUT.exists() and not args.refresh:
        try:
            existing = json.loads(OUT.read_text(encoding="utf-8")).get("airports", {})
        except Exception:
            existing = {}

    resolved = dict(existing)
    far = []
    for event in events:
        if event["id"] in resolved and not args.refresh:
            continue
        found = nearest(event, airports)
        if not found:
            continue
        resolved[event["id"]] = found
        if found["arrival"]["km"] > 400:
            far.append((event["title"], found["arrival"]))

    # Departure airports, so the app can work out where the reader would fly
    # *from* without asking and without a network call. Large scheduled
    # airports only: this is for filling in the origin box, and nobody starts
    # an international trip from an airstrip.
    departures = sorted(
        ({
            "iata": a["iata"],
            "name": a["name"],
            "place": a["municipality"] or a["country"],
            "lat": round(a["lat"], 3),
            "lon": round(a["lon"], 3),
        } for a in airports
          if a["type"] == "large_airport" and a["scheduled"]),
        key=lambda a: a["iata"]
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "note": ("Nearest airport per event. 'arrival' is the closest strip with "
                 "an IATA code; 'gateway' is the closest airport with scheduled "
                 "service big enough to reach from abroad, when that is a "
                 "different place. Distances are straight-line, not road. "
                 "'departures' is the global list of large scheduled airports, "
                 "used to resolve where the reader would fly from, on device."),
        "source": "OurAirports (public domain)",
        "airports": resolved,
        "departures": departures,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log.info("%d departure airports listed", len(departures))

    log.info("wrote %d events to %s", len(resolved), OUT.relative_to(ROOT))
    if far:
        log.info("\n%d events are over 400km from any airstrip:", len(far))
        for title, arrival in far[:10]:
            log.info("  %-38s %s, %.0fkm", title[:38], arrival["iata"], arrival["km"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
