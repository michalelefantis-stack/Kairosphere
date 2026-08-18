import { CultureItem } from '../types';
import { fetchContent } from './contentSource';

/**
 * The event catalogue, as data rather than as code.
 *
 * It used to be two TypeScript files compiled into the bundle, which meant
 * adding an event or fixing a date was a code change: a rebuild on the web,
 * and on Android a store submission with review attached. For a catalogue
 * that is edited far more often than the app is, that is backwards.
 *
 * It is now a JSON file, fetched at runtime and preferring the published
 * copy over the bundled one. Adding an event is uploading a file.
 *
 * Static JSON rather than a database, deliberately. This data is read-only,
 * identical for every reader, and needed offline — which is exactly what a
 * file on a CDN is good at and what a per-read database is bad at. Firestore
 * is already in this project for auth, and putting the catalogue in it would
 * buy writes and real-time updates nobody needs, in exchange for a network
 * round trip on every launch and a bill that grows with usage.
 */

const FILE = 'catalogue.json';

interface CataloguePayload {
  events?: CultureItem[];
  generated?: string;
  count?: number;
}

let cache: CultureItem[] | null = null;
let inFlight: Promise<LoadedCatalogue> | null = null;

export interface LoadedCatalogue {
  events: CultureItem[];
  /** When the file was generated, for showing staleness if it ever matters. */
  generated: string | null;
}

export function loadCatalogue(): Promise<LoadedCatalogue> {
  if (cache) return Promise.resolve({ events: cache, generated: null });
  // Memoise the request, not only its result. The guard below tested the
// resolved value, so two components mounting in the same tick both saw an
// empty cache and both fetched the file — every one of these was pulled
// twice on a cold start, catalogue.json included, and that one is 300KB.
  inFlight ??= fetchContent<CataloguePayload>(FILE, {}).then(payload => {
    const events = Array.isArray(payload.events) ? payload.events : [];

    // A truncated or half-written file should not empty the app. Falling back
    // to nothing is honest but useless; the caller keeps whatever it had. The
    // request is forgotten too, so a later caller can try again.
    if (events.length === 0) {
      inFlight = null;
      return { events: [], generated: null };
    }

    cache = events;
    return { events, generated: payload.generated ?? null };
  });
  return inFlight;
}
