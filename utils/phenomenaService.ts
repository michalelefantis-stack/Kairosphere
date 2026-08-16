import {
  ConfidenceBand,
  EventCategory,
  EventStatus,
  PhenomenaFeed,
  PhenomenonRecord,
  Provenance,
  SourceTier,
  UnifiedEvent
} from '../types';

/**
 * Loads the phenomena feed built by `python -m pipeline.run`.
 *
 * The one piece of logic that lives here rather than in the pipeline is decay.
 * A published confidence is only true at the moment it was generated — if the
 * cron job dies, or a phone keeps the tab open for two days, that number is
 * quietly wrong. Re-applying decay against the clock means a stale feed visibly
 * fades instead of lying with a fresh-looking badge.
 */

/**
 * Where the feed comes from, in order of preference.
 *
 * The packaged mobile app is why this is not just one path. `/data/phenomena.json`
 * is baked into the APK at build time, so a released build would carry a frozen
 * feed that only ever decays. Mobile builds set VITE_PHENOMENA_URL to the
 * published feed and refresh over the network, keeping the bundled copy as the
 * offline fallback for a first launch with no signal.
 */
const REMOTE_FEED_URL = import.meta.env.VITE_PHENOMENA_URL ?? '';
const BUNDLED_FEED_URL = 'data/phenomena.json';
const CACHE_KEY = 'kairos_phenomena_feed';
// Refuse to cache an unreasonably large feed rather than blow the quota.
const MAX_CACHE_BYTES = 2 * 1024 * 1024;

export type FeedSource = 'network' | 'cache' | 'bundled' | 'none';

// Mirrors TIER_HALF_LIFE_DAYS in pipeline/confidence.py. Keep in sync.
const HALF_LIFE_DAYS: Record<SourceTier, number | null> = {
  [SourceTier.DETERMINISTIC]: null, // orbital mechanics does not go stale
  [SourceTier.MODEL]: 3,
  [SourceTier.CITIZEN]: 7,
  [SourceTier.CURATED]: 120
};

const MIN_CONFIDENCE = 0.05;
const DAY_MS = 86400000;

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  if (confidence >= 0.2) return 'low';
  return 'speculative';
}

/** Extra decay for time elapsed since the feed was generated. */
export function decayedConfidence(
  published: number,
  tier: SourceTier,
  generatedAt: number,
  now: number = Date.now()
): number {
  const halfLife = HALF_LIFE_DAYS[tier];
  if (halfLife === null || halfLife === undefined) return published;

  const elapsedDays = Math.max(0, (now - generatedAt) / DAY_MS);
  const decayed = published * Math.pow(0.5, elapsedDays / halfLife);
  return Math.max(MIN_CONFIDENCE, decayed);
}

function toProvenance(
  record: PhenomenonRecord,
  generatedAt: number,
  now: number
): Provenance {
  const confidence = decayedConfidence(record.confidence, record.tier, generatedAt, now);
  const verifiedAt = Date.parse(record.lastVerifiedAt);

  return {
    tier: record.tier,
    confidence,
    band: bandFor(confidence),
    uncertaintyDays: record.uncertaintyDays,
    windowStart: record.windowStart,
    windowEnd: record.windowEnd,
    peak: record.peak,
    lastVerifiedAt: record.lastVerifiedAt,
    stalenessDays: Number.isNaN(verifiedAt) ? 0 : Math.max(0, (now - verifiedAt) / DAY_MS),
    sources: record.sources ?? [],
    sensitivity: record.sensitivity,
    precision: record.precision,
    consent: record.consent
  };
}

/**
 * Severity here means "how much should this interrupt you", which is a
 * different question from confidence. A near-certain equinox is not an alert;
 * a rare thing starting today is.
 */
function severityFor(record: PhenomenonRecord, now: number): 1 | 2 | 3 | 4 | 5 {
  const start = Date.parse(record.windowStart);
  const end = Date.parse(record.windowEnd);
  const active = now >= start && now <= end;

  if (!active) return 1;
  if (record.tier === SourceTier.CURATED && record.confidence >= 0.6) return 4;
  if (record.confidence >= 0.75) return 3;
  return 2;
}

export function toUnifiedEvent(
  record: PhenomenonRecord,
  generatedAt: number,
  now: number = Date.now()
): UnifiedEvent {
  const start = Date.parse(record.windowStart);
  const end = Date.parse(record.windowEnd);
  const active = now >= start && now <= end;

  return {
    uuid: record.id,
    sourceUrl: record.sources?.[0]?.url ?? '',
    severity: severityFor(record, now),
    category: record.category,
    title: `${record.emoji} ${record.name}`,
    description: record.description,
    coordinates: record.coordinates,
    startTime: start,
    endTime: end,
    status: active ? EventStatus.ACTIVE : EventStatus.SCHEDULED,
    // When this signal was last refreshed — the ticker sorts on it. The
    // human-meaningful "last verified" date lives in provenance instead, so a
    // months-old curated confirmation does not bury the entry.
    detectedAt: generatedAt,
    location: record.locationHint,
    country: record.country,
    provenance: toProvenance(record, generatedAt, now)
  };
}

export interface PhenomenaResult {
  events: UnifiedEvent[];
  generatedAt: number | null;
  /** True when the feed is old enough that its numbers deserve a caveat. */
  isStale: boolean;
  counts: PhenomenaFeed['counts'] | null;
  /** Which of the three sources actually supplied this. */
  source: FeedSource;
}

const EMPTY: PhenomenaResult = {
  events: [],
  generatedAt: null,
  isStale: false,
  counts: null,
  source: 'none'
};

// Beyond this the whole feed is suspect, not just individual entries.
const FEED_STALE_AFTER_DAYS = 2;

function isUsableFeed(value: unknown): value is PhenomenaFeed {
  return Boolean(value) && Array.isArray((value as PhenomenaFeed).events);
}

async function fetchFeed(url: string, now: number): Promise<PhenomenaFeed | null> {
  try {
    // Cache-bust per minute so a CDN edge cannot pin a stale feed for hours.
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}t=${Math.floor(now / 60000)}`);
    if (!response.ok) return null;
    const parsed = await response.json();
    return isUsableFeed(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readCache(): PhenomenaFeed | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isUsableFeed(parsed) ? parsed : null;
  } catch {
    // Corrupt or unavailable storage must never break startup.
    return null;
  }
}

function writeCache(feed: PhenomenaFeed): void {
  try {
    const serialized = JSON.stringify(feed);
    if (serialized.length > MAX_CACHE_BYTES) return;
    localStorage.setItem(CACHE_KEY, serialized);
  } catch {
    // Quota exceeded or storage disabled — the feed still works this session.
  }
}

function generatedAtOf(feed: PhenomenaFeed | null): number {
  if (!feed) return -1;
  const parsed = Date.parse(feed.generatedAt);
  return Number.isNaN(parsed) ? -1 : parsed;
}

/**
 * Load the freshest feed available.
 *
 * Candidates are compared by generatedAt rather than tried in a fixed order,
 * because "newest wins" is the only rule that holds in every case: after an
 * app update the bundled copy can be newer than a months-old cache, and after
 * a long offline stretch the cache is newer than the bundle.
 */
export async function fetchPhenomena(now: number = Date.now()): Promise<PhenomenaResult> {
  const cached = readCache();

  const [remote, bundled] = await Promise.all([
    REMOTE_FEED_URL ? fetchFeed(REMOTE_FEED_URL, now) : Promise.resolve(null),
    fetchFeed(BUNDLED_FEED_URL, now)
  ]);

  const candidates: Array<{ feed: PhenomenaFeed | null; source: FeedSource }> = [
    { feed: remote, source: 'network' },
    { feed: cached, source: 'cache' },
    { feed: bundled, source: 'bundled' }
  ];

  let best: { feed: PhenomenaFeed; source: FeedSource } | null = null;
  for (const candidate of candidates) {
    if (!candidate.feed) continue;
    if (!best || generatedAtOf(candidate.feed) > generatedAtOf(best.feed)) {
      best = { feed: candidate.feed, source: candidate.source };
    }
  }

  if (!best) {
    console.warn('[phenomena] no feed available from network, cache or bundle');
    return EMPTY;
  }

  // Only persist a feed that came off the wire; re-caching the bundle just
  // duplicates something already on disk.
  if (best.source === 'network') writeCache(best.feed);

  const generatedAt = generatedAtOf(best.feed) >= 0 ? generatedAtOf(best.feed) : now;

  const events = best.feed.events
    // The pipeline already withholds these; refusing them here too means a
    // hand-edited or stale feed cannot put one on the map.
    .filter(record => record.sensitivity !== 'sacred')
    .map(record => toUnifiedEvent(record, generatedAt, now));

  return {
    events,
    generatedAt,
    isStale: now - generatedAt > FEED_STALE_AFTER_DAYS * DAY_MS,
    counts: best.feed.counts ?? null,
    source: best.source
  };
}
