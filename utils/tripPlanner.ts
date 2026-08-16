import { CultureItem } from '../types';
import { calculateDistance } from './geo';

/**
 * Turning saved events into a plan.
 *
 * The itinerary tab used to be a search box that did less than the map's own
 * filters, sitting above a flat list of saved events. Neither answered the
 * questions someone with six saved events actually has: can any of these be
 * combined, which is next, and do two of them clash?
 *
 * All of this rests on the dates being real. Before utils/eventSchedule
 * resolved them, 89% of the catalogue sat in the past and clustering would
 * have assembled imaginary trips out of last year's festivals.
 */

const DAY_MS = 86400000;

/** Two events this far apart in time can still belong to one journey. */
export const TRIP_GAP_DAYS = 14;
/** ...provided they are also within this range of each other. */
export const TRIP_RADIUS_KM = 600;

export interface Trip {
  id: string;
  events: CultureItem[];
  start: Date;
  end: Date;
  spanDays: number;
  /** Regions covered, in visiting order, deduplicated. */
  regions: string[];
  /** Greatest distance between any two events in the trip. */
  spreadKm: number;
}

function startOf(item: CultureItem): number {
  return new Date(item.startDate).getTime();
}
function endOf(item: CultureItem): number {
  const end = new Date(item.endDate || item.startDate).getTime();
  return Number.isNaN(end) ? startOf(item) : end;
}

function distanceKm(a: CultureItem, b: CultureItem): number {
  return calculateDistance(
    a.coordinates[0], a.coordinates[1],
    b.coordinates[0], b.coordinates[1]
  ) / 1000;
}

/**
 * Group saved events into journeys.
 *
 * Greedy pass over events in date order: an event joins the trip in progress
 * when it starts within TRIP_GAP_DAYS of that trip's current end *and* sits
 * within TRIP_RADIUS_KM of something already in it. Both conditions matter —
 * two events a week apart on different continents are two trips, and two
 * events in the same valley six months apart are also two trips.
 */
export function clusterIntoTrips(items: CultureItem[]): Trip[] {
  const dated = items
    .filter(i => !Number.isNaN(startOf(i)))
    .sort((a, b) => startOf(a) - startOf(b));

  const trips: CultureItem[][] = [];

  for (const item of dated) {
    const current = trips[trips.length - 1];
    if (current) {
      const currentEnd = Math.max(...current.map(endOf));
      const gapDays = (startOf(item) - currentEnd) / DAY_MS;
      const nearSomething = current.some(e => distanceKm(e, item) <= TRIP_RADIUS_KM);
      if (gapDays <= TRIP_GAP_DAYS && nearSomething) {
        current.push(item);
        continue;
      }
    }
    trips.push([item]);
  }

  return trips.map((events, index) => {
    const start = new Date(Math.min(...events.map(startOf)));
    const end = new Date(Math.max(...events.map(endOf)));

    let spreadKm = 0;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        spreadKm = Math.max(spreadKm, distanceKm(events[i], events[j]));
      }
    }

    return {
      id: `trip-${index}-${events[0].id}`,
      events,
      start,
      end,
      spanDays: Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1),
      regions: [...new Set(events.map(e => e.region))],
      spreadKm: Math.round(spreadKm)
    };
  });
}

export interface Conflict {
  a: Trip;
  b: Trip;
  km: number;
  /** Days the two windows share. */
  overlapDays: number;
  /**
   * 'tight' is a connection worth checking; 'impossible' is a choice.
   * 1,000 km is a flight, not a contradiction — only long-haul separation
   * genuinely rules one of them out.
   */
  severity: 'tight' | 'impossible';
}

/** Beyond this, overlapping dates really do mean picking one. */
const IMPOSSIBLE_KM = 3000;

/**
 * Trips that overlap in time but not in space.
 *
 * Worth surfacing before someone books rather than after: two saved events in
 * the same fortnight on opposite sides of the planet is a decision, not a
 * plan, and nothing else in the app would ever point it out.
 */
export function findConflicts(trips: Trip[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < trips.length; i++) {
    for (let j = i + 1; j < trips.length; j++) {
      const a = trips[i];
      const b = trips[j];
      const overlaps = a.start <= b.end && b.start <= a.end;
      if (!overlaps) continue;
      const km = Math.round(distanceKm(a.events[0], b.events[0]));
      const overlapMs =
        Math.min(a.end.getTime(), b.end.getTime()) - Math.max(a.start.getTime(), b.start.getTime());
      conflicts.push({
        a,
        b,
        km,
        overlapDays: Math.max(1, Math.round(overlapMs / DAY_MS) + 1),
        severity: km >= IMPOSSIBLE_KM ? 'impossible' : 'tight'
      });
    }
  }
  return conflicts;
}

// ── lead time ─────────────────────────────────────────────────────────────

export type Urgency = 'past' | 'imminent' | 'soon' | 'planning' | 'distant';

export interface LeadTime {
  days: number;
  urgency: Urgency;
  label: string;
}

/**
 * How long until it starts, and whether that is a problem.
 *
 * Bands reflect how flights actually price rather than round numbers: inside
 * three weeks fares climb steeply, and beyond about ten months schedules are
 * not published yet.
 */
export function leadTime(item: CultureItem, now: number = Date.now()): LeadTime {
  const start = startOf(item);
  const end = endOf(item);
  const days = Math.ceil((start - now) / DAY_MS);

  if (end < now) return { days, urgency: 'past', label: 'Already finished' };
  if (start <= now) return { days: 0, urgency: 'imminent', label: 'Happening now' };
  if (days <= 21) return { days, urgency: 'imminent', label: `In ${days} days — book now` };
  if (days <= 60) return { days, urgency: 'soon', label: `In ${days} days` };
  if (days <= 300) return { days, urgency: 'planning', label: `In ${Math.round(days / 30)} months` };
  return { days, urgency: 'distant', label: `In ${Math.round(days / 30)} months` };
}

// ── travel window ─────────────────────────────────────────────────────────

export interface TravelWindow {
  from: Date;
  to: Date;
}

/**
 * What is happening while the reader is free.
 *
 * This is the query the map cannot answer. The map asks "where is this
 * event"; a traveller asks "I have these two weeks in October — what is on".
 * The app owns accurate timing, so it is the one question it is uniquely
 * placed to answer.
 */
export function eventsInWindow(
  items: CultureItem[],
  window: TravelWindow
): CultureItem[] {
  const from = window.from.getTime();
  const to = window.to.getTime();

  return items
    .filter(item => {
      const start = startOf(item);
      const end = endOf(item);
      if (Number.isNaN(start)) return false;
      // Any overlap counts — an event running into the window is still catchable.
      return start <= to && end >= from;
    })
    .sort((a, b) => startOf(a) - startOf(b));
}

/** Quick presets, because typing two dates to browse is friction. */
export function presetWindows(now: Date = new Date()): Array<{ label: string; window: TravelWindow }> {
  const at = (monthsAhead: number, day?: number) => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + monthsAhead);
    if (day) d.setUTCDate(day);
    return d;
  };

  return [
    { label: 'Next 30 days', window: { from: now, to: new Date(now.getTime() + 30 * DAY_MS) } },
    { label: 'Next 3 months', window: { from: now, to: at(3) } },
    { label: 'Next 6 months', window: { from: now, to: at(6) } },
    { label: 'Next 12 months', window: { from: now, to: at(12) } }
  ];
}

export function formatRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const s = start.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', timeZone: 'UTC'
  });
  const e = end.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
  return start.toDateString() === end.toDateString() ? e : `${s} – ${e}`;
}
