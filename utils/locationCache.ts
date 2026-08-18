import { readRecord, writeJson } from './safeStorage';

/**
 * Cached "City, Country" lookups for events.
 *
 * The catalogue's own `region` is already correct — "Montana, United States"
 * — and this only ever sharpens it to "Crow Agency, Montana". So a miss costs
 * precision, never accuracy, and the panel falls back without complaint.
 *
 * Read through a module-level snapshot rather than hitting localStorage each
 * time. The code this replaced called `getItem` and `JSON.parse` *inside the
 * render body* of list rows — once per visible card, on every render — which
 * parsed the same blob dozens of times a frame and threw if it was ever
 * malformed.
 *
 * This file used to cache generated event images too. Nothing generates them
 * any more: 268 events carry a verified photograph with a photographer and a
 * licence, and inventing a picture of a real ceremony is the opposite of what
 * the rest of this pipeline spends its effort proving.
 */

const KEY = 'kairos_locations';

let snapshot: Record<string, string> | null = null;

export function cachedLocation(eventId: string): string | undefined {
  if (snapshot === null) snapshot = readRecord(KEY);
  return snapshot[eventId];
}

export function storeLocation(eventId: string, place: string): void {
  const next = { ...(snapshot ?? readRecord(KEY)), [eventId]: place };
  snapshot = next;
  writeJson(KEY, next);
}

/** Drop the in-memory copy, e.g. after storage is cleared elsewhere. */
export function invalidateLocationCache(): void {
  snapshot = null;
}
