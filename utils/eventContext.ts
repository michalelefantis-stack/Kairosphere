/**
 * Real, per-event context — the replacement for generated filler.
 *
 * The old "in-depth analysis" split whatever text it could find into four
 * equal chunks and captioned them "Origins & Mythos", "Ritual Mechanics" and
 * so on. The headings bore no relation to the sentences underneath, and when
 * there was no article to chop up it emitted four hardcoded sentences that
 * were byte-identical on every such event.
 *
 * Everything here is either measured, computed, or absent. Nothing is padded.
 */

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';

/** Boilerplate that the ingestion scripts wrote into the dataset. */
const FILLER_PATTERNS = [
  /^automated ingestion data batch/i,
  /^an incredible cultural event occurring around/i,
  /^data batch/i,
  /^imported from/i
];

/**
 * Strip known filler so it is never presented as insight.
 * 26 events carry "Automated ingestion data batch from user request." and
 * about 24 more carry "An incredible cultural event occurring around <Month>."
 */
export function meaningfulText(value?: string | null): string | null {
  const text = (value || '').trim();
  if (text.length < 25) return null;
  if (FILLER_PATTERNS.some(p => p.test(text))) return null;
  return text;
}

// ── climate normals ───────────────────────────────────────────────────────

export interface ClimateNormals {
  /** Mean daily high and low across the sampled window, in Celsius. */
  high: number;
  low: number;
  /** Share of sampled days with measurable rain, 0-1. */
  wetDayShare: number;
  /** Mean total rainfall on wet days, mm. */
  wetDayRain: number;
  yearsSampled: number;
  daysSampled: number;
}

const DAY_MS = 86400000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * What the weather is normally like *during this event*, rather than what it
 * happens to be doing right now.
 *
 * Today's temperature at the venue is useless for a festival four months out;
 * "typically 19-30C, rain on 3 days in 4" is the thing that decides what you
 * pack and whether you go at all.
 *
 * Sampled from the same calendar window in each of the last `years` years.
 */
export async function fetchClimateNormals(
  lat: number,
  lon: number,
  windowStart: Date,
  windowEnd: Date,
  years = 5
): Promise<ClimateNormals | null> {
  const spanDays = Math.min(
    30,
    Math.max(5, Math.round((windowEnd.getTime() - windowStart.getTime()) / DAY_MS) + 4)
  );

  const thisYear = new Date().getUTCFullYear();
  const requests: Promise<Response>[] = [];

  for (let i = 1; i <= years; i++) {
    const year = thisYear - i;
    const start = new Date(Date.UTC(year, windowStart.getUTCMonth(), windowStart.getUTCDate()));
    const end = new Date(start.getTime() + spanDays * DAY_MS);
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      start_date: isoDay(start),
      end_date: isoDay(end),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
      timezone: 'UTC'
    });
    requests.push(fetch(`${ARCHIVE}?${params}`));
  }

  try {
    const responses = await Promise.allSettled(requests);
    const highs: number[] = [];
    const lows: number[] = [];
    const rain: number[] = [];
    let yearsSampled = 0;

    for (const result of responses) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue;
      const daily = (await result.value.json())?.daily;
      if (!daily?.time?.length) continue;
      yearsSampled += 1;
      daily.temperature_2m_max?.forEach((v: number | null) => v !== null && highs.push(v));
      daily.temperature_2m_min?.forEach((v: number | null) => v !== null && lows.push(v));
      daily.precipitation_sum?.forEach((v: number | null) => v !== null && rain.push(v));
    }

    if (!highs.length || !lows.length) return null;

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // 1mm is the conventional threshold for a "wet day".
    const wetDays = rain.filter(mm => mm >= 1);

    return {
      high: Math.round(mean(highs)),
      low: Math.round(mean(lows)),
      wetDayShare: rain.length ? wetDays.length / rain.length : 0,
      wetDayRain: wetDays.length ? Math.round(mean(wetDays)) : 0,
      yearsSampled,
      daysSampled: highs.length
    };
  } catch {
    return null;
  }
}

// ── daylight ──────────────────────────────────────────────────────────────

export interface Daylight {
  sunrise: string;
  sunset: string;
  hours: number;
  /** True when taken from the same date a year earlier. */
  approximated: boolean;
}

/**
 * Sunrise and sunset at the venue on the event's date.
 *
 * Matters more than it looks: a sunrise alignment, a meteor shower or an
 * aurora is entirely governed by when it gets dark, and that varies hugely
 * with latitude and season.
 *
 * For dates outside the forecast horizon this reads the same calendar date a
 * year earlier, which is within a couple of minutes, and says so.
 */
export async function fetchDaylight(
  lat: number,
  lon: number,
  date: Date
): Promise<Daylight | null> {
  const now = Date.now();
  const withinForecast = date.getTime() > now - 30 * DAY_MS && date.getTime() < now + 14 * DAY_MS;

  const target = withinForecast
    ? date
    : new Date(Date.UTC(new Date().getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate()));

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: isoDay(target),
    end_date: isoDay(target),
    daily: 'sunrise,sunset',
    timezone: 'auto'
  });

  try {
    const response = await fetch(`${ARCHIVE}?${params}`);
    if (!response.ok) return null;
    const daily = (await response.json())?.daily;
    const sunrise = daily?.sunrise?.[0];
    const sunset = daily?.sunset?.[0];
    if (!sunrise || !sunset) return null;

    const hours = (Date.parse(sunset) - Date.parse(sunrise)) / 3600000;
    return {
      sunrise: sunrise.slice(11, 16),
      sunset: sunset.slice(11, 16),
      hours: Math.round(hours * 10) / 10,
      approximated: !withinForecast
    };
  } catch {
    return null;
  }
}

// ── encyclopaedia ─────────────────────────────────────────────────────────

export interface Encyclopedia {
  title: string;
  extract: string;
  url: string;
  /** The article found is a near-miss rather than the event itself. */
  approximate: boolean;
}

/**
 * One Wikipedia article, whole and attributed.
 *
 * Deliberately not chopped into quarters and relabelled — if the article does
 * not discuss ritual mechanics, no heading here will claim it does.
 */
export async function fetchEncyclopedia(
  title: string,
  region: string
): Promise<Encyclopedia | null> {
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim();
  const queries = [title, cleanTitle, `${cleanTitle} ${region.split(',').pop()?.trim() ?? ''}`];

  for (const query of queries) {
    if (!query) continue;
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&generator=search' +
      `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=extracts` +
      '&exintro=1&explaintext=1&format=json&origin=*';
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const pages = (await response.json())?.query?.pages;
      if (!pages) continue;
      const page = pages[Object.keys(pages)[0]];
      if (!page?.extract || page.extract.length < 80) continue;

      const found = String(page.title);
      return {
        title: found,
        extract: page.extract.trim(),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(found.replace(/ /g, '_'))}`,
        approximate: found.toLowerCase() !== title.toLowerCase()
          && found.toLowerCase() !== cleanTitle.toLowerCase()
      };
    } catch {
      // try the next query
    }
  }
  return null;
}

// ── phrasing helpers ──────────────────────────────────────────────────────

export function describeRain(share: number): string {
  if (share < 0.1) return 'rain is rare';
  if (share < 0.3) return 'occasional rain';
  if (share < 0.6) return 'rain on some days';
  if (share < 0.85) return 'rain on most days';
  return 'rain almost daily';
}

/** How a date is arrived at, which is the honest answer to "is this reliable". */
export function describeRecurrence(recurrence?: string): string | null {
  if (!recurrence) return null;
  const map: Record<string, string> = {
    'annual, solar': 'Set by the sun’s position — the same moment every year, computable centuries ahead.',
    'annual, lunisolar': 'Set by a lunisolar calendar, so the Gregorian date moves each year.',
    'annual, Hijri': 'Fixed in the Hijri calendar, so it shifts about 11 days earlier each Gregorian year, and local moon sighting can move it by a day.',
    annual: 'Held at about the same point each year.',
    'annual, observed': 'Timing inferred from where observations cluster each year.',
    'annual, temperature-driven': 'Driven by accumulated warmth, so it arrives earlier in a hot spring and later in a cold one.',
    'solar-driven, episodic': 'Driven by solar activity — episodic rather than scheduled.',
    fixed: 'A fixed calendar date.',
    month_window: 'Announced within a rough window rather than on a fixed date.',
    explicit: 'Dates confirmed individually for this occurrence.'
  };
  return map[recurrence] ?? null;
}
