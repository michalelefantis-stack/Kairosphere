import { GoogleGenAI } from '@google/genai';

/**
 * The only place in the codebase that touches the Gemini key.
 *
 * It is read from the environment at call time, never bundled, never returned
 * to a client, and never interpolated into an error message.
 */

let client = null;

export function hasApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getClient() {
  if (!hasApiKey()) {
    const error = new Error('GEMINI_API_KEY is not set on the server');
    error.status = 503;
    error.public = 'AI features are not configured on this server.';
    throw error;
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Upstream errors get logged in full and reported to the client in outline.
 * A raw SDK error can carry the request URL, which embeds the key.
 */
export function sanitizeError(error, fallback = 'Upstream AI request failed.') {
  const status = error?.status && Number.isInteger(error.status) ? error.status : 502;
  console.error('[gemini]', error?.message ?? error);
  return { status, message: error?.public ?? fallback };
}

/** Parse a JSON response body, tolerating the odd code fence. */
export function parseJsonResponse(text, fallback = {}) {
  if (!text) return fallback;
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('[gemini] response was not valid JSON');
    return fallback;
  }
}

/** First grounding URL behind a search-grounded answer, if there is one. */
export function firstGroundingUrl(response, fallback = '') {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return fallback;
  const hit = chunks.find(chunk => chunk?.web?.uri);
  return hit?.web?.uri ?? fallback;
}
