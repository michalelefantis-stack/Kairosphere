
export enum EventCategory {
  RITUAL = 'Human Ritual',
  MIGRATION = 'Animal Migration',
  FLORA = 'Botanical Event',
  COSMIC = 'Cosmic Event',
  ATMOSPHERIC = 'Atmospheric Phenomenon',
  UNREST = 'Civil Unrest'
}

export enum EventStatus {
  ACTIVE = 'Active',
  SCHEDULED = 'Scheduled',
  HISTORICAL = 'Historical'
}

export interface UnifiedEvent {
  uuid: string;
  sourceUrl: string; // The "Listener" source
  severity: 1 | 2 | 3 | 4 | 5; // 1 = Info, 5 = Global Alert
  category: EventCategory;
  title: string;
  description: string;
  coordinates: [number, number];
  startTime: number;
  endTime: number; // For TTL
  status: EventStatus;
  detectedAt: number;
  location?: string;
  country?: string;
  /** Present only for events from the phenomena pipeline. */
  provenance?: Provenance;
}

// --- PHENOMENA PIPELINE (see pipeline/README.md) ---

/** Which method produced a prediction, and therefore how far to trust it. */
export enum SourceTier {
  DETERMINISTIC = 1, // astronomy and calendar math
  MODEL = 2,         // published scientific model output
  CITIZEN = 3,       // aggregated crowd observations
  CURATED = 4        // human-verified, review-gated
}

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'speculative';

export interface PhenomenonSource {
  name: string;
  url: string;
  kind: 'deterministic' | 'model' | 'citizen' | 'curated';
  retrievedAt: string;
  note?: string;
}

/**
 * Everything needed to show a reader *why* a date is being claimed.
 * This is the product: not "the crabs migrate in November", but
 * "predicted 12-19 Nov, +/-4 days, 72% confidence, last verified 2 days ago".
 */
export interface Provenance {
  tier: SourceTier;
  /** Decay-adjusted for the time since the feed was generated. */
  confidence: number;
  band: ConfidenceBand;
  uncertaintyDays: number;
  windowStart: string;
  windowEnd: string;
  peak: string | null;
  lastVerifiedAt: string;
  /** Days since a human or a feed last stood behind this date. */
  stalenessDays: number;
  sources: PhenomenonSource[];
  sensitivity: 'public' | 'restricted' | 'sacred';
  precision: 'point' | 'regional' | 'country';
  consent?: string;
}

export interface PhenomenonRecord {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
  emoji: string;
  tier: SourceTier;
  coordinates: [number, number];
  locationHint: string;
  country: string;
  windowStart: string;
  windowEnd: string;
  peak: string | null;
  uncertaintyDays: number;
  confidence: number;
  baseConfidence: number;
  lastVerifiedAt: string;
  sources: PhenomenonSource[];
  sensitivity: 'public' | 'restricted' | 'sacred';
  precision: 'point' | 'regional' | 'country';
  consent: string;
  recurrence: string;
}

export interface PhenomenaFeed {
  schemaVersion: number;
  generatedAt: string;
  horizonDays: number;
  counts: {
    total: number;
    active: number;
    byTier: Record<string, number>;
    byBand: Record<string, number>;
  };
  events: PhenomenonRecord[];
}

// Re-export legacy types for compatibility if needed, 
// though we are moving to UnifiedEvent for the live system.
export enum RitualType {
  FESTIVAL = 'Festival',
  CEREMONY = 'Ceremony',
  SPIRITUAL = 'Spiritual',
  PILGRIMAGE = 'Pilgrimage',
  PERFORMANCE = 'Performance',
  PHENOMENON = 'Phenomenon'
}

export interface Book {
  id?: string;
  title: string;
  author: string;
  coverUrl?: string;
  url?: string;
  amazonLink?: string;
  bookshopLink?: string;
  goodreadsRating?: number;
  ratingCount?: string;
  description?: string;
}

export interface CultureItem {
  id: string;
  title: string;
  coordinates: [number, number];
  ritualType: RitualType;
  subCategory?: string;
  startDate: string;
  endDate: string;
  verified: boolean;
  description: string;
  region: string;
  preciseLocation?: string;
  imageUrl: string;
  gallery?: string[];
  insights?: string;
  mediaLinks: {
    audio?: string;
    video?: string;
    api?: string;
  };
  recommendedBooks?: Book[];
  tourLink?: string;
  analysis?: any;
  /** Set by utils/eventSchedule: date comes from a lunar/lunisolar calendar. */
  dateIsMovable?: boolean;
  /** Set by utils/eventSchedule: date was projected forward from a past record. */
  dateWasProjected?: boolean;
  /** Set by utils/eventSchedule: stored date is a bulk-import placeholder. */
  dateIsUnconfirmed?: boolean;
  /** Set by utils/eventImages: provenance for a verified photograph. */
  imageCredit?: {
    credit: string;
    license: string;
    licenseUrl: string;
    sourcePage: string;
    verifiedBy: string;
  };
}

export interface FilterState {
  search: string;
  type: string; // simplified for hybrid use
  region: string;
  month: number;
}

// --- NEW TYPES FOR LIVE INTELLIGENCE SYSTEM ---

export interface LiveRitual {
  id: string;
  type: string;
  title: string;
  coordinates: [number, number];
  status: 'live' | 'archived';
  startTime: number;
  expiresAt: number;
  etiquette: string;
  imageUrl: string | null;
  confidence: number;
}

export interface AgentLog {
  id: string;
  agent: 'SCOUT' | 'POLYGLOT' | 'FACT_CHECKER' | 'ARCHITECT';
  message: string;
  timestamp: number;
  status: 'processing' | 'success' | 'failed';
  data?: any;
}

export interface RawIntercept {
  source: string;
  language: string;
  rawText: string;
  timestamp: number;
  metadata?: any;
}
