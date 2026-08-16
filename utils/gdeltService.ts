import { UnifiedEvent, EventCategory, EventStatus, CultureItem, RitualType } from '../types';
import { MOCK_CULTURE_DATA } from '../mockData';
import { COUNTRY_COORDS } from './countryCoords';

function getEonetCategory(catId: string): EventCategory {
  catId = catId.toLowerCase();
  if (catId.includes('volcano') || catId.includes('wildfire') || catId.includes('storm')) return EventCategory.ATMOSPHERIC;
  if (catId.includes('ice') || catId.includes('snow')) return EventCategory.ATMOSPHERIC;
  return EventCategory.COSMIC; // Fallback
}

const GLOBAL_CURRENT_EVENTS: CultureItem[] = [
    {
        id: 'vernal-equinox',
        title: 'Vernal Equinox & Chichen Itza Serpent',
        coordinates: [20.6843, -88.5678],
        ritualType: RitualType.PHENOMENON,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        verified: true,
        region: 'Mexico',
        description: 'The sun aligns perfectly with the Pyramid of Kukulkan, casting a shadow that creates the illusion of a massive feathered serpent descending the steps.',
        imageUrl: 'https://images.unsplash.com/photo-1518182170546-076616fdceac?auto=format&fit=crop&w=800&q=80',
        mediaLinks: {}
    },
    {
        id: 'nowruz-global',
        title: 'Nowruz (Persian New Year)',
        coordinates: [35.6892, 51.3890],
        ritualType: RitualType.FESTIVAL,
        startDate: '2026-03-20',
        endDate: '2026-03-21',
        verified: true,
        region: 'Iran / Central Asia',
        description: 'The festival of spring, celebrating the rebirth of nature across the Silk Road. Involves Haft-Sin tables and jumping over fires (Chaharshanbe Suri).',
        imageUrl: 'https://images.unsplash.com/photo-1584988450143-6d0ff2dd6e20?auto=format&fit=crop&w=800&q=80',
        mediaLinks: {}
    },
    {
        id: 'las-fallas',
        title: 'Las Fallas de Valencia',
        coordinates: [39.4699, -0.3763],
        ritualType: RitualType.FESTIVAL,
        startDate: '2026-03-15',
        endDate: '2026-03-19',
        verified: true,
        region: 'Spain',
        description: 'A massive pyrotechnic festival where giant satirical effigies (Fallas) are built in the streets and ceremonially burned to the ground on the final night.',
        imageUrl: 'https://images.unsplash.com/photo-1552554625-f37648fddbb7?auto=format&fit=crop&w=800&q=80',
        mediaLinks: {}
    },
    {
        id: 'eid-al-fitr',
        title: 'Eid al-Fitr',
        coordinates: [21.4225, 39.8262],
        ritualType: RitualType.SPIRITUAL,
        startDate: '2026-03-19',
        endDate: '2026-03-20',
        verified: true,
        region: 'Global / Mecca',
        description: 'The "Festival of Breaking the Fast" marking the end of Ramadan, featuring communal morning prayers and massive feasts.',
        imageUrl: 'https://images.unsplash.com/photo-1564750130635-f09c733eeaa8?auto=format&fit=crop&w=800&q=80',
        mediaLinks: {}
    },
    {
        id: 'hanami-kyoto',
        title: 'Hanami Blossoms (Early Bloom)',
        coordinates: [35.0116, 135.7681],
        ritualType: RitualType.FESTIVAL,
        startDate: '2026-03-22',
        endDate: '2026-04-10',
        verified: true,
        region: 'Japan',
        description: 'The ancient practice of viewing the blooming of sakura (cherry blossoms). Parks are filled with blue tarps and nighttime sake parties under illuminated falling petals.',
        imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
        mediaLinks: {}
    }
];

export async function fetchGdeltLiveEvents(): Promise<UnifiedEvent[]> {
  const events: UnifiedEvent[] = [];
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  try {
    const eonetRes = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10");
    const eonetData = await eonetRes.json();
    
    if (eonetData && eonetData.events) {
      eonetData.events.slice(0, 30).forEach((ev: any, index: number) => {
        let coords: [number, number] | null = null;
        if (ev.geometries && ev.geometries.length > 0) {
           const geom = ev.geometries[ev.geometries.length - 1];
           if (geom.type === 'Point' && geom.coordinates) {
               coords = [geom.coordinates[1], geom.coordinates[0]];
           }
        }
        
        if (coords) {
          const categoryId = ev.categories && ev.categories.length > 0 ? ev.categories[0].id : '';
          events.push({
            uuid: `eonet-${ev.id}-${index}`,
            sourceUrl: ev.link || "https://eonet.gsfc.nasa.gov",
            severity: 4,
            category: getEonetCategory(categoryId),
            title: ev.title || "Atmospheric Phenomenon",
            description: "Live planetary telemetry confirmed by NASA Earth Observatory open feeds.",
            coordinates: coords,
            startTime: now, 
            endTime: now + (24 * 60 * 60 * 1000),
            status: EventStatus.ACTIVE,
            detectedAt: now,
            location: "Earth Observatory",
            country: "Global"
          });
        }
      });
    }
  } catch (err) {
    console.error("EONET fetch failed", err);
  }

  // 1.5 Fetch Real-Time Global Public Holidays (Nager.Date API)
  try {
    const nagerRes = await fetch("https://date.nager.at/api/v3/NextPublicHolidaysWorldwide");
    const holidays = await nagerRes.json();

    if (holidays && Array.isArray(holidays)) {
      holidays.forEach((hol: any, index: number) => {
        const holTime = new Date(hol.date).getTime();
        const isHappeningNow = now >= holTime && now <= holTime + 86400000;
        
        if (isHappeningNow) {
          const coords = COUNTRY_COORDS[hol.countryCode];
          if (coords) {
             const jitterLat = coords[0] + (Math.random() - 0.5) * 2;
             const jitterLng = coords[1] + (Math.random() - 0.5) * 2;

             events.push({
               uuid: `holiday-${hol.countryCode}-${hol.date}-${index}`,
               sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(hol.name)}`,
               severity: 2,
               category: EventCategory.RITUAL, 
               title: hol.name,
               description: `Public Festival/Holiday. Local name: ${hol.localName}`,
               coordinates: [jitterLat, jitterLng],
               startTime: holTime,
               endTime: holTime + 86400000, 
               status: isHappeningNow ? EventStatus.ACTIVE : EventStatus.SCHEDULED,
               detectedAt: now,
               location: hol.localName,
               country: hol.countryCode
             });
          }
        }
      });
    }
  } catch (err) {
    console.error("Nager.Date Holidays fetch failed", err);
  }

  const ALL_CULTURES = [...MOCK_CULTURE_DATA, ...GLOBAL_CURRENT_EVENTS];
  const activeAndUpcomingCultures = ALL_CULTURES.filter(cult => {
     const start = new Date(cult.startDate).getTime();
     const end = new Date(cult.endDate).getTime();
     const isHappeningNow = now >= start && now <= end + 86400000; 
     return isHappeningNow;
  });

  const rigorousSelection = activeAndUpcomingCultures.slice(0, 60);

  rigorousSelection.forEach((cult: CultureItem, index: number) => {
      let category = EventCategory.RITUAL;
      if (cult.description.toLowerCase().includes('animal') || cult.description.toLowerCase().includes('fish')) category = EventCategory.MIGRATION;
      
      const realStart = new Date(cult.startDate).getTime();
      const realEnd = new Date(cult.endDate).getTime();
      
      events.push({
          uuid: `culture-live-${cult.id}-${index}-${now}`,
          sourceUrl: cult.mediaLinks?.video || "https://en.wikipedia.org/wiki/Culture",
          severity: 2, 
          category: category,
          title: cult.title,
          description: cult.description,
          coordinates: cult.coordinates,
          startTime: realStart, 
          endTime: Math.max(now + 86400000, realEnd),
          status: realStart > now ? EventStatus.SCHEDULED : EventStatus.ACTIVE,
          detectedAt: now,
          location: cult.preciseLocation || cult.region,
          country: cult.region
      });
  });

  // --- 4. PYTHON RESEARCH PIPELINE (GeoJSON from scripts/research_events.py) ---
  try {
    const res = await fetch('/data/live_events.geojson?t=' + Date.now());
    if (res.ok) {
      const geojson = await res.json();
      const features = geojson?.features || [];

      // Map GeoJSON categories to our EventCategory enum
      const CATEGORY_MAP: Record<string, EventCategory> = {
        'indigenous_culture': EventCategory.RITUAL,
        'religious_ceremony': EventCategory.RITUAL,
        'ancient_heritage':   EventCategory.RITUAL,
        'nature_gathering':   EventCategory.FLORA,
        'natural_phenomenon': EventCategory.MIGRATION,
        'grand_spectacle':    EventCategory.RITUAL,
        'earths_rhythm':      EventCategory.RITUAL,
        'fixed_calendar':     EventCategory.RITUAL,
      };

      for (const feature of features) {
        const props = feature.properties;
        const coords = feature.geometry?.coordinates; // [lng, lat]
        if (!coords || !props) continue;

        // Parse UTC times from ISO strings
        const startMs = props.startUtc ? new Date(props.startUtc).getTime() : now;
        const endMs   = props.endUtc   ? new Date(props.endUtc).getTime()   : now + 86400000;

        // Only include events within the live window (server already filtered, but double-check)
        if (!props.isWithinLiveWindow) continue;

        const category = CATEGORY_MAP[props.category] || EventCategory.RITUAL;
        const severity: 1|2|3|4|5 = props.confidence >= 0.8 ? 3 : 2;

        events.push({
          uuid: `py-geo-${feature.id}`,
          sourceUrl: props.sourceUrl || '',
          severity,
          category,
          title: `${props.emoji || '🌍'} ${props.name}`,
          description: props.description || `${props.categoryLabel} — ${props.locationHint}`,
          coordinates: [coords[1], coords[0]], // GeoJSON is [lng,lat], we use [lat,lng]
          startTime: startMs,
          endTime: endMs,
          status: EventStatus.ACTIVE,
          detectedAt: now,
          location: props.locationHint,
          country: props.geocodedAddress,
        });
      }

      console.log(`[LiveResearch] Loaded ${features.length} GeoJSON cultural events`);
    }
  } catch (err) {
    // Silently fail — file may not exist if script hasn't been run yet
    console.debug('live_events.geojson not available (run: python scripts/research_events.py)');
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduped = events.filter(e => {
    const key = e.title.toLowerCase().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => a.startTime - b.startTime);
}
