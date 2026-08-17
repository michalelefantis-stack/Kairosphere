import { readJson, readRecord, writeJson } from './safeStorage';

/**
 * Cache of AI-generated event images.
 *
 * Read through a module-level snapshot rather than hitting localStorage each
 * time. The previous code called `getItem` and `JSON.parse` *inside the render
 * body* of list rows — once per visible card, on every render — which parsed
 * the same blob dozens of times a frame and threw if it was ever malformed.
 */

const KEY = 'kairos_ai_images';

let snapshot: Record<string, string> | null = null;

function cache(): Record<string, string> {
  if (snapshot === null) snapshot = readRecord(KEY);
  return snapshot;
}

/** The generated image for an event, or the fallback. */
export function aiImageFor(eventId: string, fallback: string): string {
  return cache()[eventId] || fallback;
}

export function storeAiImage(eventId: string, dataUrl: string): void {
  const next = { ...cache(), [eventId]: dataUrl };
  snapshot = next;
  // Generated images are large; a full cache should not break saving.
  if (!writeJson(KEY, next)) {
    console.warn('[images] could not persist generated image — storage full?');
  }
}

/** Drop the in-memory copy, e.g. after storage is cleared elsewhere. */
export function invalidateAiImageCache(): void {
  snapshot = null;
}

/** Cached "City, Country" lookups, same guarding. */
const LOCATION_KEY = 'kairos_locations';
let locations: Record<string, string> | null = null;

export function cachedLocation(eventId: string): string | undefined {
  if (locations === null) locations = readRecord(LOCATION_KEY);
  return locations[eventId];
}

export function storeLocation(eventId: string, place: string): void {
  const next = { ...(locations ?? readRecord(LOCATION_KEY)), [eventId]: place };
  locations = next;
  writeJson(LOCATION_KEY, next);
}
