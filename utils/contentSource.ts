/**
 * Where the app's content files come from.
 *
 * There are two kinds of update, and confusing them is how a published app
 * becomes hard to fix.
 *
 *   code      components, layout, logic. Changing this needs a build, and on
 *             mobile a store release with review attached.
 *   content   descriptions, photographs, airports, the live feed. Changing
 *             this should need neither.
 *
 * Until now only the phenomena feed knew that difference. Briefings, images
 * and airports were fetched on a relative path, so they were baked into the
 * bundle — which meant correcting a single wrong photograph required a full
 * release, and on Android a wait for review. Given how many of those
 * corrections there have been, that is the wrong default.
 *
 * Set VITE_CONTENT_BASE_URL to wherever the JSON is published and the app
 * reads it from there, falling back to the bundled copy when the network is
 * unavailable — which is also what makes the first launch work offline.
 */

const REMOTE_BASE = (import.meta.env.VITE_CONTENT_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Fetch a content file, preferring the published copy.
 *
 * Deliberately not cached across calls here: each loader keeps its own
 * module-level cache, so this runs once per file per session.
 */
export async function fetchContent<T>(filename: string, fallback: T): Promise<T> {
  const paths = REMOTE_BASE
    ? [`${REMOTE_BASE}/${filename}`, `data/${filename}`]
    : [`data/${filename}`];

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      return (await response.json()) as T;
    } catch {
      // Try the next path. A failed remote fetch is expected offline and is
      // not worth surfacing — the bundled copy is a legitimate answer.
    }
  }
  return fallback;
}
