import express from 'express';
import cors from 'cors';

import geminiRouter, { createLiveToken } from './routes/gemini.js';
import { hasApiKey } from './services/gemini.js';

/**
 * Kairosphere backend.
 *
 * Exists for one reason: the Gemini key must never reach a browser. Everything
 * here is in service of that — a named-operation allowlist instead of a
 * passthrough, ephemeral tokens for the Live API, and an origin allowlist so
 * the endpoint is not a public credit line.
 *
 *   GEMINI_API_KEY=...  node --env-file=.env index.js
 */

const app = express();
const PORT = Number(process.env.PORT) || 8787;

// Base64 image uploads are the largest legitimate payload.
app.use(express.json({ limit: '8mb' }));

// Default covers local dev; set ALLOWED_ORIGINS in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ??
  'http://localhost:3000,http://localhost:4173,capacitor://localhost,http://localhost')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin and native webview requests arrive without an Origin header.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Tagged so the error handler answers 403 rather than a confusing 500.
    const error = new Error(`Origin not allowed: ${origin}`);
    error.status = 403;
    error.public = 'Origin not allowed.';
    callback(error);
  }
}));

/**
 * Coarse in-memory rate limit.
 *
 * Not a substitute for real quota management, but enough that a leaked
 * endpoint cannot drain the billing account overnight. Swap for a shared
 * store if this ever runs on more than one instance.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;
const hits = new Map();

function rateLimit(req, res, next) {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const record = hits.get(key);

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }
  record.count += 1;
  next();
}

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of hits) {
    if (now > record.resetAt) hits.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    // Whether a key is configured, never the key or any part of it.
    aiConfigured: hasApiKey(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.post('/api/ai/live-token', rateLimit, createLiveToken);
app.use('/api/ai', rateLimit, geminiRouter);

app.use((error, _req, res, _next) => {
  console.error('[server]', error?.message ?? error);
  res.status(error?.status ?? 500).json({ error: error?.public ?? 'Request failed.' });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!hasApiKey()) {
    console.warn('[server] GEMINI_API_KEY is not set — AI endpoints will return 503.');
  }
  console.log(`[server] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
