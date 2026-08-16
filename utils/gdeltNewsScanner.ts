import { UnifiedEvent, EventCategory, EventStatus } from '../types';

/**
 * GDELT DOC 2.0 API - Cultural News Scanner
 * 
 * This module queries the GDELT DOC API (100% free, no API key) to find
 * breaking cultural news happening RIGHT NOW around the world.
 * 
 * It scans for: funerals, processions, coronations, pilgrimages, 
 * religious ceremonies, indigenous gatherings, and other unplanned
 * cultural phenomena that a tourist would want to know about.
 */

// Cultural keyword groups — each query targets a different type of breaking event
const CULTURAL_QUERIES = [
  // Royal / State ceremonies
  'funeral procession OR coronation OR royal ceremony OR state funeral',
  // Religious / Spiritual
  'religious procession OR pilgrimage gathering OR sacred ceremony',
  // Indigenous / Tribal
  'tribal ceremony OR indigenous gathering OR traditional ritual',
  // Festivals / Celebrations (breaking / unplanned)
  'cultural festival OR harvest celebration OR solstice ceremony',
  // Death / Mourning rites
  'mourning rite OR burial ceremony OR memorial procession',
];

// ALWAYS-ON: Civil Unrest queries — combined into one maximally broad query
const UNREST_QUERY = 'protest OR demonstration OR riot OR uprising OR rally OR strike OR clashes OR "civil unrest" OR "tear gas" OR crackdown';

/**
 * Fetch with retry and exponential backoff to handle GDELT rate limits.
 */
async function fetchWithRetry(url: string, retries = 2, delayMs = 1500): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return null;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry?: string;
}

interface GdeltGeoFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    name: string;
    charoffset: number;
    count?: number;
  };
}

/**
 * Fetch breaking cultural news articles from GDELT DOC API.
 * Returns up to ~75 articles across multiple cultural keyword groups.
 */
async function fetchGdeltCulturalArticles(): Promise<GdeltArticle[]> {
  const allArticles: GdeltArticle[] = [];
  const seenUrls = new Set<string>();

  // Run unrest mega-query + 1 random cultural query (sequential to avoid rate limits)
  const selectedCultural = CULTURAL_QUERIES[Math.floor(Math.random() * CULTURAL_QUERIES.length)];
  const allQueries = [UNREST_QUERY, selectedCultural];

  // Run sequentially with a delay between each to avoid 429
  for (const query of allQueries) {
    try {
      const params = new URLSearchParams({
        query: query,
        mode: 'ArtList',
        maxrecords: '50',
        timespan: '72h',
        format: 'json',
        sort: 'DateDesc',
      });

      const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
      const res = await fetchWithRetry(url);
      
      if (!res) continue;
      
      const data = await res.json();
      const articles: GdeltArticle[] = data?.articles || [];
      
      articles.forEach(a => {
        if (!seenUrls.has(a.url)) {
          seenUrls.add(a.url);
          allArticles.push(a);
        }
      });
    } catch (err) {
      console.warn(`GDELT DOC query failed for: "${query}"`, err);
    }
    
    // Small delay between queries to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  return allArticles;
}

/**
 * Fetch geographic locations mentioned in GDELT news for a cultural query.
 * Uses the GDELT GEO 2.0 API (100% free, returns GeoJSON).
 */
async function fetchGdeltGeoLocations(): Promise<GdeltGeoFeature[]> {
  try {
    const query = 'ceremony OR procession OR festival OR ritual OR pilgrimage OR protest OR demonstration';
    const params = new URLSearchParams({
      query: query,
      format: 'GeoJSON',
      timespan: '72h',
      maxpoints: '75',
    });

    const url = `https://api.gdeltproject.org/api/v2/geo/geo?${params.toString()}`;
    const res = await fetchWithRetry(url);
    
    if (!res) return [];
    
    const geoData = await res.json();
    return geoData?.features || [];
  } catch (err) {
    console.warn('GDELT GEO query failed', err);
    return [];
  }
}

/**
 * Classify a news article into a severity level based on keywords.
 */
function classifySeverity(title: string): 1 | 2 | 3 | 4 | 5 {
  const t = title.toLowerCase();
  // Unrest — highest urgency for traveler safety
  if (t.includes('riot') || t.includes('uprising') || t.includes('clashes') || t.includes('tear gas') || t.includes('crackdown')) return 5;
  if (t.includes('protest') || t.includes('demonstration') || t.includes('strike') || t.includes('march') || t.includes('rally')) return 4;
  // Cultural
  if (t.includes('death') || t.includes('funeral') || t.includes('dies') || t.includes('killed')) return 4;
  if (t.includes('coronation') || t.includes('king') || t.includes('queen') || t.includes('pope')) return 5;
  if (t.includes('procession') || t.includes('pilgrimage') || t.includes('sacred')) return 3;
  if (t.includes('festival') || t.includes('ceremony') || t.includes('celebration')) return 2;
  return 2;
}

/**
 * Determine if an article is about civil unrest vs cultural event.
 */
function isUnrestArticle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes('protest') || t.includes('riot') || t.includes('demonstration')
    || t.includes('uprising') || t.includes('strike') || t.includes('rally')
    || t.includes('unrest') || t.includes('clashes') || t.includes('tear gas')
    || t.includes('crackdown') || t.includes('activists') || t.includes('dissent');
}

/**
 * Extract a rough country name from a GDELT source country code.
 */
function getCountryFromCode(code?: string): string {
  if (!code) return 'Unknown';
  const map: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', IN: 'India', TH: 'Thailand',
    JP: 'Japan', AU: 'Australia', FR: 'France', DE: 'Germany', BR: 'Brazil',
    MX: 'Mexico', EG: 'Egypt', SA: 'Saudi Arabia', IT: 'Italy', ES: 'Spain',
    NG: 'Nigeria', KE: 'Kenya', ZA: 'South Africa', CN: 'China', KR: 'South Korea',
    ID: 'Indonesia', PH: 'Philippines', NP: 'Nepal', LK: 'Sri Lanka', MM: 'Myanmar',
    ET: 'Ethiopia', GH: 'Ghana', TZ: 'Tanzania', PE: 'Peru', CO: 'Colombia',
    TR: 'Turkey', IR: 'Iran', IQ: 'Iraq', PK: 'Pakistan', BD: 'Bangladesh',
  };
  return map[code.toUpperCase()] || code;
}

/**
 * Main entry: Fetch breaking cultural events from GDELT and return as UnifiedEvents.
 * This combines article data with geographic data for maximum coverage.
 */
export async function fetchBreakingCulturalEvents(): Promise<UnifiedEvent[]> {
  const events: UnifiedEvent[] = [];
  const now = Date.now();

  // Strategy 1: GEO API — get geolocated cultural mentions
  try {
    const geoFeatures = await fetchGdeltGeoLocations();
    
    geoFeatures.forEach((feature, index) => {
      if (feature.geometry?.type === 'Point' && feature.geometry.coordinates) {
        const [lng, lat] = feature.geometry.coordinates;
        const name = feature.properties?.name || 'Cultural Event';
        
        events.push({
          uuid: `gdelt-geo-${name.replace(/\s/g, '-')}-${index}-${now}`,
          sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' ceremony festival')}`,
          severity: 2,
          category: EventCategory.RITUAL,
          title: `Cultural Activity: ${name}`,
          description: `GDELT global media monitoring has detected significant cultural activity mentions near ${name} in the last 48 hours.`,
          coordinates: [lat, lng],
          startTime: now - (24 * 60 * 60 * 1000),
          endTime: now + (24 * 60 * 60 * 1000),
          status: EventStatus.ACTIVE,
          detectedAt: now,
          location: name,
          country: name,
        });
      }
    });
  } catch (err) {
    console.warn('GDELT GEO cultural scan failed', err);
  }

  // Strategy 2: DOC API — get actual news articles about cultural events
  try {
    const articles = await fetchGdeltCulturalArticles();
    
    // We don't get coordinates from articles directly, but we can cross-reference
    // with GEO data or use the sourcecountry field as a rough location
    articles.slice(0, 20).forEach((article, index) => {
      const severity = classifySeverity(article.title);
      const country = getCountryFromCode(article.sourcecountry);
      
      // Only include articles that are culturally significant (severity >= 3)
      // or that explicitly mention ceremonies/funerals in the title
      const titleLower = article.title.toLowerCase();
      const isCultural = titleLower.includes('funeral') || titleLower.includes('ceremony')
        || titleLower.includes('procession') || titleLower.includes('ritual')
        || titleLower.includes('festival') || titleLower.includes('pilgrimage')
        || titleLower.includes('coronation') || titleLower.includes('mourning')
        || titleLower.includes('sacred') || titleLower.includes('tribal')
        || titleLower.includes('indigenous') || titleLower.includes('tradition')
        || titleLower.includes('protest') || titleLower.includes('riot')
        || titleLower.includes('demonstration') || titleLower.includes('rally')
        || titleLower.includes('uprising') || titleLower.includes('strike')
        || titleLower.includes('unrest') || titleLower.includes('clashes')
        || severity >= 3;

      if (!isCultural) return;

      const category = isUnrestArticle(article.title) ? EventCategory.UNREST : EventCategory.RITUAL;

      events.push({
        uuid: `gdelt-news-${index}-${now}`,
        sourceUrl: article.url,
        severity: severity,
        category: category,
        title: article.title,
        description: `Breaking cultural intelligence detected via global media monitoring. Source: ${article.domain}`,
        coordinates: [0, 0], // Will be enriched by GEO data or country lookup
        startTime: new Date(article.seendate).getTime() || now,
        endTime: now + (48 * 60 * 60 * 1000),
        status: EventStatus.ACTIVE,
        detectedAt: now,
        location: country,
        country: country,
      });
    });
  } catch (err) {
    console.warn('GDELT DOC cultural scan failed', err);
  }

  // Deduplicate by similar titles
  const seen = new Set<string>();
  const deduplicated = events.filter(e => {
    const key = e.title.toLowerCase().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduplicated;
}
