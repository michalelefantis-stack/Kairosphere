import { CultureItem } from '../types';
import { fetchContent } from './contentSource';

/**
 * Real descriptions, held as static data rather than fetched per view.
 *
 * The catalogue's own descriptions run to 83 characters at the median and are
 * often templated — fifty events open with "A spectacular natural phenomenon
 * in <place>." The detail panel papered over this by calling the Wikipedia
 * search API every time an event was opened, which fails with no signal,
 * repeats the same query on every open, and never checked that the article it
 * found was about the right subject.
 *
 * Built by `python -m pipeline.briefings`, which does check — the article has
 * to name the event and its place, and has to read like an event rather than
 * a place or a people. That test exists because "Crow Fair" first retrieved
 * "Crow Indian Reservation".
 *
 * The text is CC BY-SA, so the source link travels with it and is rendered
 * alongside, not tucked away.
 */

export interface EventBriefing {
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
  /** Which words tied this article to this event, e.g. "nyepi + bali". */
  verifiedBy: string;
  chars: number;
}

let cache: Record<string, EventBriefing> | null = null;

export async function loadEventBriefings(): Promise<Record<string, EventBriefing>> {
  if (cache) return cache;
  const payload = await fetchContent<{ briefings?: Record<string, EventBriefing> }>(
    'event_briefings.json', {}
  );
  cache = payload.briefings ?? {};
  return cache;
}

/** Synchronous read, for components rendering after the load has settled. */
export function briefingFor(id: string): EventBriefing | null {
  return cache?.[id] ?? null;
}

/**
 * Is the catalogue's own description worth showing?
 *
 * Two templates account for most of the noise: the bulk-import line and the
 * "A spectacular natural phenomenon in X. Timing: Y." pattern. Both restate
 * the title and the region, which are already on screen directly above.
 */
const BOILERPLATE = [
  /^Automated ingestion/i,
  /An incredible cultural event occurring around/i,
  /^A spectacular natural phenomenon in .{1,60}\.\s*Timing:/i
];

export function meaningfulDescription(item: CultureItem): string | null {
  const text = (item.description ?? '').trim();
  if (text.length < 60) return null;
  if (BOILERPLATE.some(p => p.test(text))) return null;
  return text;
}
