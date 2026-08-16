/**
 * Which country is this coordinate in?
 *
 * Resolved on the device, never on a server. The local-news feeds are one
 * static file per country, so the client works out its own country and fetches
 * only that file — meaning nothing anywhere learns where the reader is
 * standing. For a "what's happening near me" feature that is the difference
 * between a useful tool and a tracking product.
 *
 * Bounding boxes rather than polygons: a full boundary set is hundreds of
 * kilobytes for a decision whose only consequence is which national news feed
 * to read. Near a border the answer may be the neighbour's feed, which is
 * usually the right answer for a traveller anyway. Overlapping boxes are
 * resolved by the nearest centroid.
 *
 * Only the countries with a verified feed are listed — see
 * pipeline/registry/locales.json. Anywhere else returns null, and the UI says
 * there is no local coverage rather than inventing some.
 */

interface CountryBox {
  code: string;
  name: string;
  /** [south, west, north, east] */
  bbox: [number, number, number, number];
}

// Approximate mainland extents. Outlying territories are deliberately omitted:
// French Guiana should not make a reader in Cayenne read the Paris feed.
const COUNTRIES: CountryBox[] = [
  { code: 'ID', name: 'Indonesia',    bbox: [-11.0, 95.0, 6.1, 141.0] },
  { code: 'JP', name: 'Japan',        bbox: [24.0, 122.9, 45.6, 146.0] },
  { code: 'TH', name: 'Thailand',     bbox: [5.6, 97.3, 20.5, 105.7] },
  { code: 'VN', name: 'Vietnam',      bbox: [8.2, 102.1, 23.4, 109.5] },
  { code: 'IN', name: 'India',        bbox: [6.7, 68.1, 35.5, 97.4] },
  { code: 'NP', name: 'Nepal',        bbox: [26.3, 80.0, 30.5, 88.2] },
  { code: 'PH', name: 'Philippines',  bbox: [4.6, 116.9, 21.1, 126.6] },
  { code: 'MY', name: 'Malaysia',     bbox: [0.8, 99.6, 7.4, 119.3] },
  { code: 'KR', name: 'South Korea',  bbox: [33.1, 125.9, 38.6, 129.6] },
  { code: 'TW', name: 'Taiwan',       bbox: [21.9, 119.5, 25.3, 122.0] },
  { code: 'LK', name: 'Sri Lanka',    bbox: [5.9, 79.6, 9.9, 81.9] },
  { code: 'KH', name: 'Cambodia',     bbox: [10.4, 102.3, 14.7, 107.6] },
  { code: 'MM', name: 'Myanmar',      bbox: [9.8, 92.2, 28.5, 101.2] },

  { code: 'ES', name: 'Spain',        bbox: [36.0, -9.3, 43.8, 3.3] },
  { code: 'IT', name: 'Italy',        bbox: [36.6, 6.6, 47.1, 18.5] },
  { code: 'PT', name: 'Portugal',     bbox: [36.9, -9.5, 42.2, -6.2] },
  { code: 'FR', name: 'France',       bbox: [42.3, -4.8, 51.1, 8.2] },
  { code: 'GR', name: 'Greece',       bbox: [34.8, 19.3, 41.8, 28.3] },
  { code: 'PL', name: 'Poland',       bbox: [49.0, 14.1, 54.8, 24.2] },
  { code: 'RO', name: 'Romania',      bbox: [43.6, 20.2, 48.3, 29.7] },
  { code: 'BG', name: 'Bulgaria',     bbox: [41.2, 22.3, 44.2, 28.6] },
  { code: 'RS', name: 'Serbia',       bbox: [42.2, 18.8, 46.2, 23.0] },
  { code: 'UA', name: 'Ukraine',      bbox: [44.3, 22.1, 52.4, 40.2] },
  { code: 'GE', name: 'Georgia',      bbox: [41.0, 40.0, 43.6, 46.7] },
  { code: 'TR', name: 'Turkey',       bbox: [35.8, 25.6, 42.1, 44.8] },
  { code: 'IL', name: 'Israel',       bbox: [29.5, 34.2, 33.3, 35.9] },
  { code: 'IR', name: 'Iran',         bbox: [25.0, 44.0, 39.8, 63.3] },

  { code: 'MX', name: 'Mexico',       bbox: [14.5, -118.4, 32.7, -86.7] },
  { code: 'GT', name: 'Guatemala',    bbox: [13.7, -92.3, 17.8, -88.2] },
  { code: 'CO', name: 'Colombia',     bbox: [-4.3, -79.0, 12.5, -66.9] },
  { code: 'EC', name: 'Ecuador',      bbox: [-5.0, -81.1, 1.5, -75.2] },
  { code: 'PE', name: 'Peru',         bbox: [-18.4, -81.4, -0.1, -68.7] },
  { code: 'BO', name: 'Bolivia',      bbox: [-22.9, -69.7, -9.7, -57.5] },
  { code: 'BR', name: 'Brazil',       bbox: [-33.8, -74.0, 5.3, -34.8] },
  { code: 'US', name: 'United States',bbox: [24.5, -125.0, 49.4, -66.9] },

  { code: 'MA', name: 'Morocco',      bbox: [27.7, -13.2, 35.9, -1.0] },
  { code: 'EG', name: 'Egypt',        bbox: [22.0, 24.7, 31.7, 36.9] },
  { code: 'SN', name: 'Senegal',      bbox: [12.3, -17.6, 16.7, -11.4] },
  { code: 'GH', name: 'Ghana',        bbox: [4.7, -3.3, 11.2, 1.2] },
  { code: 'NG', name: 'Nigeria',      bbox: [4.2, 2.7, 13.9, 14.7] },
  { code: 'KE', name: 'Kenya',        bbox: [-4.7, 33.9, 5.5, 41.9] },
  { code: 'TZ', name: 'Tanzania',     bbox: [-11.8, 29.3, -0.9, 40.5] },
  { code: 'ZA', name: 'South Africa', bbox: [-34.9, 16.4, -22.1, 32.9] },

  { code: 'AU', name: 'Australia',    bbox: [-43.7, 112.9, -10.0, 153.7] },
  { code: 'NZ', name: 'New Zealand',  bbox: [-47.3, 166.4, -34.4, 178.6] },
  { code: 'PG', name: 'Papua New Guinea', bbox: [-11.7, 140.8, -1.3, 155.9] }
];

function contains(box: CountryBox, lat: number, lon: number): boolean {
  const [s, w, n, e] = box.bbox;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

/**
 * Box area in square degrees — the tie-break when boxes overlap.
 *
 * Nearest-centroid seems obvious and is wrong for long countries: Chiang Mai
 * sits inside both the Thai and the Burmese box, and Myanmar's centre is the
 * closer of the two, so centroid distance put a Thai city in Myanmar. The
 * smaller box is the more specific claim — Nepal over India, Thailand over
 * Myanmar, Peru over Brazil — and it gets all of those right.
 */
function boxArea(box: CountryBox): number {
  const [s, w, n, e] = box.bbox;
  return (n - s) * (e - w);
}

export interface CountryMatch {
  code: string;
  name: string;
  /** True when more than one box contained the point. */
  ambiguous: boolean;
}

/** The covered country containing this point, or null where there is no feed. */
export function countryForCoords(lat: number, lon: number): CountryMatch | null {
  const hits = COUNTRIES.filter(c => contains(c, lat, lon));
  if (hits.length === 0) return null;
  if (hits.length === 1) {
    return { code: hits[0].code, name: hits[0].name, ambiguous: false };
  }
  // Boxes overlap wherever countries interlock; the tightest one wins.
  const best = hits.reduce((a, b) => (boxArea(a) <= boxArea(b) ? a : b));
  return { code: best.code, name: best.name, ambiguous: true };
}

export function coveredCountries(): string[] {
  return COUNTRIES.map(c => c.code);
}
