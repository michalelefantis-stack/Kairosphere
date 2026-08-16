import { CultureItem } from '../types';

/**
 * Resolves each curated event to its next occurrence.
 *
 * The dataset stores one historical instance per event — 89% of them already
 * in the past, 98 still on 2025 dates. Rewriting the years would only push the
 * problem to next August, so the stored date is treated as a *pattern* (month,
 * day, duration) and projected onto the coming year at load time.
 *
 * Three cases are handled separately because they fail differently:
 *
 *   annual    same month and day every year — project it forward
 *   movable   set by a lunar or lunisolar calendar, so the Gregorian date
 *             shifts every year and projection would be wrong. Several of
 *             these sit on an obvious placeholder (five different Islamic
 *             observances all dated 2026-05-01), so the stored date is not
 *             shown as fact at all.
 *   corrupt   endDate before startDate, which exists in the data today
 */

const DAY_MS = 86400000;

/**
 * Events whose date is set by a non-Gregorian calendar.
 *
 * The pipeline computes these properly in pipeline/calendars.py — Ashura from
 * the Hijri calendar, Diwali from the Kartika new moon, Lunar New Year from
 * the second new moon after the December solstice. The curated copies here
 * cannot be projected arithmetically, so they are marked instead of guessed.
 */
const MOVABLE_PATTERNS = [
  /\beid\b/i,
  /ramadan/i,
  /ashura/i,
  /muharram/i,
  /mawlid/i,
  /diwali/i,
  /deepavali/i,
  /holi\b/i,
  /purnima/i,
  /vesak/i,
  /lunar new year/i,
  /chinese new year/i,
  /easter/i,
  /passover/i,
  /rosh hashanah/i,
  /yom kippur/i,
  /hanukkah/i,
  /navratri/i,
  /onam/i,
  /losar/i
];

export function isMovableFeast(title: string): boolean {
  return MOVABLE_PATTERNS.some(p => p.test(title));
}

/**
 * A bulk import wrote this same date onto every record it created — 77 events
 * across four continents all claiming to start on 1 May. It is a placeholder,
 * not a date, so it is reported as unknown rather than projected forward into
 * a confident-looking lie.
 */
const PLACEHOLDER_DATES = new Set(['2026-05-01']);

export function isPlaceholderDate(startDate: string): boolean {
  return PLACEHOLDER_DATES.has(startDate);
}

export interface ResolvedSchedule {
  startDate: string;
  endDate: string;
  /** Years added to the stored date to reach this occurrence. */
  rolledForwardBy: number;
  /** Date is set by a lunar/lunisolar calendar and cannot be projected. */
  movable: boolean;
  /** The stored record had endDate before startDate. */
  repaired: boolean;
  /** The stored date is a bulk-import placeholder, not a real date. */
  unconfirmed: boolean;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Project a stored instance onto the next occurrence.
 *
 * Duration is preserved rather than projecting start and end independently,
 * which is what keeps events spanning the new year intact — Rann Utsav runs
 * November to February and must stay four months long, not collapse to
 * negative.
 */
export function resolveSchedule(
  item: Pick<CultureItem, 'title' | 'startDate' | 'endDate'> & { dateIsMovable?: boolean },
  now: Date = new Date()
): ResolvedSchedule {
  const stored = new Date(item.startDate);
  const stopStored = new Date(item.endDate || item.startDate);
  // An explicit flag on the record wins: title matching is a fallback for the
  // legacy catalogue, and it cannot know that Nyepi or Bau Nyale are lunar.
  const movable = item.dateIsMovable ?? isMovableFeast(item.title);
  const unconfirmed = isPlaceholderDate(item.startDate);

  if (Number.isNaN(stored.getTime())) {
    return {
      startDate: item.startDate,
      endDate: item.endDate,
      rolledForwardBy: 0,
      movable,
      repaired: false,
      unconfirmed
    };
  }

  // Guard the corrupt rows: a negative span becomes a single day.
  let durationMs = stopStored.getTime() - stored.getTime();
  const repaired = Number.isNaN(durationMs) || durationMs < 0;
  if (repaired) durationMs = 0;

  // A movable feast keeps its stored date; the UI labels it as unreliable
  // rather than inventing a projection that would be wrong by weeks.
  if (movable) {
    return {
      startDate: iso(stored),
      endDate: iso(new Date(stored.getTime() + durationMs)),
      rolledForwardBy: 0,
      movable: true,
      repaired,
      unconfirmed
    };
  }

  // Roll forward until the event has not already finished.
  let years = 0;
  let start = new Date(stored);
  while (start.getTime() + durationMs < now.getTime() && years < 12) {
    years += 1;
    start = new Date(stored);
    start.setUTCFullYear(stored.getUTCFullYear() + years);
  }

  return {
    startDate: iso(start),
    endDate: iso(new Date(start.getTime() + durationMs)),
    rolledForwardBy: years,
    movable: false,
    repaired,
    unconfirmed
  };
}

/**
 * Apply the resolver across the catalogue.
 *
 * Runs once when mockData loads, so every downstream consumer — the map
 * filter, the calendar grouping, the insights panel — sees upcoming dates
 * without needing to know any of this.
 */
export function withResolvedSchedules(items: CultureItem[], now: Date = new Date()): CultureItem[] {
  return items.map(item => {
    const resolved = resolveSchedule(item, now);
    return {
      ...item,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      dateIsMovable: resolved.movable,
      dateWasProjected: resolved.rolledForwardBy > 0,
      dateIsUnconfirmed: resolved.unconfirmed
    } as CultureItem;
  });
}
