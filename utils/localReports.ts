import { countryForCoords } from './countryLookup';

/**
 * Unconfirmed local reports for wherever the reader is.
 *
 * Fetches exactly one static file — the country's own — which is what keeps
 * the whole feature off any server log. See utils/countryLookup.
 *
 * Everything here is a newspaper headline that a classifier thinks describes
 * an attendable public event. It is not a verified listing, and the UI has to
 * keep saying so.
 */

const BASE = (import.meta.env.VITE_LOCAL_FEED_URL ?? 'data/local').replace(/\/$/, '');

export interface LocalReport {
  id: string;
  country: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  publishedAt: string;
  kind: 'ceremony' | 'phenomenon' | 'none' | 'unclassified';
  isPublic: boolean | null;
  place: string;
  whenText: string;
  confidence: number;
  reasons: string[];
}

export interface LocalFeed {
  country: string;
  name: string;
  generatedAt: string;
  refreshHours: number;
  /** 'unconfirmed' when the classifier ran; 'unfiltered' when it did not. */
  status: 'unconfirmed' | 'unfiltered';
  count: number;
  reports: LocalReport[];
}

export interface LocalReportsResult {
  countryName: string | null;
  reports: LocalReport[];
  generatedAt: number | null;
  /** No feed exists for this part of the world. */
  uncovered: boolean;
  /** A feed exists but has not been through the classifier. */
  suppressed: boolean;
}

const EMPTY: LocalReportsResult = {
  countryName: null,
  reports: [],
  generatedAt: null,
  uncovered: true,
  suppressed: false
};

// Headlines older than this are no use to somebody standing there today.
const MAX_AGE_DAYS = 10;
// Below this the classifier is barely more confident than a coin toss.
const MIN_CONFIDENCE = 0.25;

export async function fetchLocalReports(
  coords: [number, number] | null | undefined,
  now: number = Date.now()
): Promise<LocalReportsResult> {
  if (!coords) return EMPTY;

  const match = countryForCoords(coords[0], coords[1]);
  if (!match) return EMPTY;

  try {
    const response = await fetch(`${BASE}/${match.code}.json?t=${Math.floor(now / 3600000)}`);
    if (!response.ok) {
      return { ...EMPTY, countryName: match.name, uncovered: true };
    }

    const feed = (await response.json()) as LocalFeed;

    // Without the classifier nothing has been checked for relevance or for
    // being somebody's private funeral. Refuse to render it rather than dump
    // raw headlines on the reader.
    if (feed.status !== 'unconfirmed') {
      return {
        countryName: match.name,
        reports: [],
        generatedAt: Date.parse(feed.generatedAt) || null,
        uncovered: false,
        suppressed: true
      };
    }

    const cutoff = now - MAX_AGE_DAYS * 86400000;
    const reports = (feed.reports ?? [])
      .filter(r => r.kind === 'ceremony' || r.kind === 'phenomenon')
      // Belt and braces: the pipeline already withholds these.
      .filter(r => r.isPublic !== false)
      .filter(r => r.confidence >= MIN_CONFIDENCE)
      .filter(r => (Date.parse(r.publishedAt) || 0) >= cutoff)
      .sort((a, b) => b.confidence - a.confidence);

    return {
      countryName: feed.name || match.name,
      reports,
      generatedAt: Date.parse(feed.generatedAt) || null,
      uncovered: false,
      suppressed: false
    };
  } catch {
    return { ...EMPTY, countryName: match.name };
  }
}
