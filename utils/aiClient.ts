/**
 * The browser's only route to Gemini.
 *
 * No API key exists on this side any more. Every call names a server-defined
 * operation and passes data; the prompt, model and schema live in
 * server/routes/gemini.js. The Live API is the one exception — a WebSocket
 * cannot be proxied this way, so the server mints a short-lived, single-use
 * token instead.
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

async function callOperation<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api/ai/${operation}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  });

  if (!response.ok) {
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

export interface LiveSession {
  token: string;
  model: string;
  /** The exact LiveConnectConfig the token is bound to. */
  config: Record<string, any>;
}

export interface VerificationResult {
  isRitual: boolean;
  confidence: number;
  type: string;
  title: string;
  etiquette: string;
  reasoning: string;
}

export const aiClient = {
  /** "City, Country" for an event. */
  async preciseLocation(title: string, description: string): Promise<string> {
    const { location } = await callOperation<{ location: string }>('precise-location', {
      title,
      description
    });
    return location;
  },

  /** Generated header image as a data URL, or null if none came back. */
  async eventImage(title: string, region: string, description: string): Promise<string | null> {
    const { dataUrl } = await callOperation<{ dataUrl: string | null }>('event-image', {
      title,
      region,
      description
    });
    return dataUrl;
  },

  /** Does this photo show a ritual? */
  verifyRitualImage(image: string): Promise<VerificationResult> {
    return callOperation<VerificationResult>('verify-ritual-image', { image });
  },

  /** A cultural event happening right now, with its grounding source. */
  pulseIngest(): Promise<{ event: Record<string, any>; sourceUrl: string }> {
    return callOperation('pulse-ingest');
  },

  scout(location: string): Promise<{ source?: string; language?: string; rawText?: string }> {
    return callOperation('scout', { location });
  },

  polyglot(rawText: string, language: string): Promise<{ eventName?: string; location?: string; category?: string }> {
    return callOperation('polyglot', { rawText, language });
  },

  factCheck(eventName: string, location: string): Promise<{ verified?: boolean; confidence?: number; sourceUrls?: string[] }> {
    return callOperation('fact-check', { eventName, location });
  },

  geocode(location: string): Promise<{ lat: number; lng: number }> {
    return callOperation('geocode', { location });
  },

  /**
   * Short-lived token for a direct Live API WebSocket. Single use, expires in
   * about a minute if unspent, and locked server-side to the audio model and
   * the narration persona. The returned config must be passed to connect()
   * verbatim, since the token is bound to exactly those values.
   */
  async liveToken(ritual: { title: string; type: string; etiquette: string }): Promise<LiveSession> {
    const response = await fetch(`${API_BASE}/api/ai/live-token`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(ritual)
    });
    if (!response.ok) {
      let message = `Could not start a live session (${response.status})`;
      try {
        const body = await response.json();
        if (body?.error) message = body.error;
      } catch {
        // fall through with the status message
      }
      throw new AiUnavailableError(message, response.status);
    }
    return response.json();
  }
};
