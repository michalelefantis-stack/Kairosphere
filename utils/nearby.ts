import { CultureItem } from '../types';
import { calculateDistance } from './geo';
import { leadTime } from './tripPlanner';
import { occurrenceKind } from './eventSchedule';

/**
 * Ranking events for someone who is already travelling.
 *
 * The map cannot do this. A map answers "where is the thing I have already
 * heard of"; it has no time axis and no opinion, so on a phone it shows 373
 * overlapping dots and leaves the reader to work out which one matters. The
 * question an actual backpacker asks is narrower and has one answer: what is
 * worth moving towards from here, and how long have I got.
 *
 * Two quantities decide that, and neither is useful alone. An extraordinary
 * festival 9,000 km away is not a plan. A mediocre one tomorrow in the next
 * town might be. So the ranking multiplies reachability by time pressure and
 * sorts on the product.
 *
 * Deliberately not personalised, not learned, and not weighted by anything
 * the app knows about the reader beyond where they are standing. A ranking
 * nobody can predict is one nobody can trust, and trust is the product.
 */

const DAY_MS = 86400000;

/**
 * Distance bands, in kilometres, and what they mean to someone on the ground.
 *
 * These are overland-travel bands, not map bands: the boundaries sit roughly
 * where the mode of transport has to change. Under 50 km is a local bus or a
 * taxi. Under 300 is a day's travel. Under 1,200 is a long night on a bus or
 * a train. Beyond that you are buying a flight, which is a different
 * decision with a different budget.
 */
const REACH_BANDS: { maxKm: number; score: number; effort: string }[] = [
  { maxKm: 50, score: 1.0, effort: 'in reach today' },
  { maxKm: 300, score: 0.8, effort: 'a day’s travel' },
  { maxKm: 1200, score: 0.5, effort: 'an overnight haul' },
  { maxKm: 4000, score: 0.2, effort: 'a flight away' },
  { maxKm: Infinity, score: 0.05, effort: 'the other side of the world' }
];

export interface Reach {
  km: number;
  /** Rounded for display: "42 km", "1,100 km". */
  label: string;
  /** What getting there actually involves. */
  effort: string;
  score: number;
}

export function reachFrom(
  coords: [number, number],
  item: CultureItem
): Reach | null {
  const [lat, lon] = coords;
  const [elat, elon] = item.coordinates ?? [];
  if (typeof elat !== 'number' || typeof elon !== 'number') return null;

  const km = calculateDistance(lat, lon, elat, elon) / 1000;
  const band = REACH_BANDS.find(b => km <= b.maxKm)!;

  return {
    km,
    label: km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`,
    effort: band.effort,
    score: band.score
  };
}

/**
 * How much the timing presses.
 *
 * Peaks in the window where a trip is still possible but the decision cannot
 * be deferred. Something starting tomorrow scores below something starting in
 * a week, because tomorrow is usually already lost — you cannot cross a
 * border overnight — and an event eight months out scores low because there
 * is nothing to do about it yet.
 */
function pressure(item: CultureItem, now: number): number {
  const kind = occurrenceKind(item);
  // No date to be early or late for, so no pressure — but still findable.
  if (kind === 'always') return 0.25;
  if (item.dateIsUnconfirmed) return 0.1;

  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate || item.startDate).getTime();
  if (Number.isNaN(start)) return 0.1;

  // Already running: pressure is how little of it is left.
  if (start <= now) {
    if (!Number.isNaN(end) && end < now) return 0;
    const daysLeft = Number.isNaN(end) ? 1 : (end - now) / DAY_MS;
    if (kind === 'season') return daysLeft <= 30 ? 0.8 : 0.45;
    return 1.0;
  }

  const daysAway = (start - now) / DAY_MS;
  if (daysAway <= 2) return 0.55;   // probably too late to move
  if (daysAway <= 14) return 1.0;   // the actionable window
  if (daysAway <= 45) return 0.75;
  if (daysAway <= 120) return 0.4;
  return 0.15;
}

export interface RankedEvent {
  item: CultureItem;
  reach: Reach | null;
  score: number;
  /** Short reason this surfaced, shown on the card. */
  why: string;
}

/**
 * Order the catalogue for a reader standing at `coords`.
 *
 * Without a location there is nothing to be near, so it falls back to pure
 * time pressure — which is still a better default than catalogue order.
 */
export function rankNearby(
  items: CultureItem[],
  coords: [number, number] | null,
  now: number = Date.now()
): RankedEvent[] {
  return items
    .map(item => {
      const reach = coords ? reachFrom(coords, item) : null;
      const press = pressure(item, now);
      const score = press * (reach ? reach.score : 1);
      const lead = leadTime(item, now);

      // The card explains itself: near and soon reads differently from
      // far and soon, and the reader should not have to compare two numbers
      // to work out which they are looking at.
      let why = lead.label;
      if (reach && reach.score >= 0.8 && press >= 0.75) {
        why = `${lead.label} · ${reach.effort}`;
      }

      return { item, reach, score, why };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break on distance so the closer of two equally-timed events wins.
      const ak = a.reach?.km ?? Infinity;
      const bk = b.reach?.km ?? Infinity;
      return ak - bk;
    });
}
