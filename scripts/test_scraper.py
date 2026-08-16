import json
from datetime import datetime, timezone, timedelta
from research_events import CulturalEvent, build_utc_bounds

now = datetime.now(timezone.utc)
events = [
    CulturalEvent(
        name="Gathering of Nations Pow Wow",
        category="indigenous_culture",
        emoji="🪘",
        color="#E07B39",
        location_hint="Albuquerque, New Mexico",
        latitude=35.0844,
        longitude=-106.6504,
        explicit_coords_found=True,
        geocoded_address="Albuquerque, New Mexico",
        start_date=now.strftime("%Y-%m-%d"),
        end_date=(now + timedelta(days=2)).strftime("%Y-%m-%d"),
        description="📍 Location: Albuquerque, USA\n🌐 Coordinates: 35.084423, -106.650411",
        image_url="https://images.unsplash.com/photo-1542359649-31e03cd4d909?auto=format&fit=crop&w=800&q=80",
        source_url="https://gatheringofnations.com",
        source_title="Gathering of Nations Pow Wow 2026",
        is_within_live_window=True,
        hours_remaining=48.0,
        minutes_until_start=0.0,
        relevance_score=8,
        date_confidence=0.95,
        search_trait="indigenous_ritual"
    ),
    CulturalEvent(
        name="Semana Santa Procession",
        category="religious_ceremony",
        emoji="🕯️",
        color="#9B59B6",
        location_hint="Seville, Spain",
        latitude=37.3891,
        longitude=-5.9845,
        explicit_coords_found=True,
        geocoded_address="Seville, Andalusia, Spain",
        start_date=now.strftime("%Y-%m-%d"),
        end_date=now.strftime("%Y-%m-%d"),
        description="📍 Location: Seville, Andalusia, Spain\n🌐 Coordinates: 37.389092, -5.984459",
        source_url="https://visitsevillaspain.com",
        source_title="Holy Week (Semana Santa) Seville 2026",
        is_within_live_window=True,
        hours_remaining=12.5,
        minutes_until_start=0.0,
        relevance_score=10,
        date_confidence=0.9,
        search_trait="religious_spectacle"
    )
]

for e in events:
    e.start_utc, _ = build_utc_bounds(e.start_date)
    _, e.end_utc = build_utc_bounds(e.end_date)

geojson = {
    "type": "FeatureCollection",
    "metadata": {
        "generated_at": now.isoformat(),
        "total_live": 2,
        "note": "Populated by fast discovery module for UI validation"
    },
    "features": [e.to_geojson_feature() for e in events]
}

with open("public/data/live_events.geojson", "w", encoding="utf-8") as fh:
    json.dump(geojson, fh, indent=2, default=str)
print("Wrote 2 test events to live_events.geojson")
