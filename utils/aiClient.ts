/**
 * The browser's only route to Gemini.
 *
 * No API key exists on this side. The call names a server-defined operation
 * and passes data; the prompt, model and schema live in
 * server/routes/gemini.js.
 *
 * One operation is left. The others — a generated event image, a live audio
 * narration, a ritual-photo verifier and a four-stage news-scouting agent —
 * were all written, all wired to a server route, and none of them reachable:
 * two components were imported and never rendered, one rendered behind a tab
 * with no way to select it, and the image generator was a function nobody
 * called. They are in git if they are ever wanted.
 *
 * What survives is a nicety, not a dependency. `preciseLocation` sharpens
 * "Montana, United States" to "Crow Agency, Montana"; without a server the
 * panel shows the catalogue's own region, which was already right.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
// Matches APP_TOKEN on the server. Not a secret in any meaningful sense — it
// ships in the bundle — but it stops a stranger who finds the endpoint from
// casually spending the quota.
const APP_TOKEN = import.meta.env.VITE_APP_TOKEN ?? '';

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return APP_TOKEN ? { ...extra, 'x-app-token': APP_TOKEN } : extra;
}

export class AiUnavailableError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiUnavailableError';
    this.status = status;
  }
}

/**
 * Set once the backend has answered "not here".
 *
 * Deploying without a server is a supported choice — the app degrades to the
 * catalogue's own data — but the client used to re-ask on every event opened,
 * so a static deployment fired one doomed request per panel and logged one
 * error per panel. One is enough to learn from.
 */
let backendAbsent = false;

async function callOperation<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  if (backendAbsent) {
    throw new AiUnavailableError('AI features are not configured on this server.', 503);
  }

  const response = await fetch(`${API_BASE}/api/ai/${operation}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    // 404 means nothing is serving /api at all; 501/503 mean the server is
    // there but has no key. Either way, asking again will not help.
    if ([404, 501, 503].includes(response.status)) backendAbsent = true;

    let message = `AI request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; the status line is all we have.
    }
    throw new AiUnavailableError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const aiClient = {
  /** "City, Country" for an event. */
  async preciseLocation(title: string, description: string): Promise<string> {
    const { location } = await callOperation<{ location: string }>('precise-location', {
      title,
      description
    });
    return location;
  }
};
