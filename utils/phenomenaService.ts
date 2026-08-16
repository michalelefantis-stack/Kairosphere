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

const FEED_URL = '/data/phenomena.json';

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
}

const EMPTY: PhenomenaResult = {
  events: [],
  generatedAt: null,
  isStale: false,
  counts: null
};

// Beyond this the whole feed is suspect, not just individual entries.
const FEED_STALE_AFTER_DAYS = 2;

export async function fetchPhenomena(now: number = Date.now()): Promise<PhenomenaResult> {
  try {
    const response = await fetch(`${FEED_URL}?t=${Math.floor(now / 60000)}`);
    if (!response.ok) return EMPTY;

    const feed = (await response.json()) as PhenomenaFeed;
    if (!feed || !Array.isArray(feed.events)) return EMPTY;

    const generatedAt = Date.parse(feed.generatedAt) || now;

    const events = feed.events
      // The pipeline already withholds these; refusing them here too means a
      // hand-edited or stale feed cannot put one on the map.
      .filter(record => record.sensitivity !== 'sacred')
      .map(record => toUnifiedEvent(record, generatedAt, now));

    return {
      events,
      generatedAt,
      isStale: now - generatedAt > FEED_STALE_AFTER_DAYS * DAY_MS,
      counts: feed.counts ?? null
    };
  } catch (error) {
    console.warn('[phenomena] feed unavailable:', error);
    return EMPTY;
  }
}
