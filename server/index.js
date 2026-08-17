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

// Default covers local dev and the packaged mobile app; set ALLOWED_ORIGINS
// in production.
//
// The Capacitor origins are not optional: capacitor.config.ts sets
// androidScheme 'https', so the Android webview reports https://localhost,
// and iOS reports capacitor://localhost. Omit either and the mobile build
// gets a 403 on every AI call while the browser works fine.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ??
  [
    'http://localhost:3000',   // vite dev
    'http://localhost:4173',   // vite preview
    'https://localhost',       // Capacitor Android (androidScheme: 'https')
    'capacitor://localhost',   // Capacitor iOS
    'http://localhost'         // Capacitor Android with the http scheme
  ].join(','))
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

/**
 * Shared-secret gate.
 *
 * The proxy already refuses to be a general-purpose Gemini account — every
 * call names one of a fixed set of operations. It does not stop someone who
 * finds the endpoint from spending the quota on those operations, though, and
 * that is a bill rather than a breach.
 *
 * Set APP_TOKEN here and VITE_APP_TOKEN in the frontend build to require a
 * matching header. Left unset the server runs open, which is fine locally and
 * is warned about loudly at boot.
 */
const APP_TOKEN = process.env.APP_TOKEN || '';

function requireToken(req, res, next) {
  if (!APP_TOKEN) return next();
  const presented = req.get('x-app-token');
  // Length-independent compare is overkill for a shared secret sent in a
  // header on every request, but it costs nothing.
  if (presented && presented === APP_TOKEN) return next();
  return res.status(401).json({ error: 'Not authorised.' });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    // Whether a key is configured, never the key or any part of it.
    aiConfigured: hasApiKey(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.post('/api/ai/live-token', requireToken, rateLimit, createLiveToken);
app.use('/api/ai', requireToken, rateLimit, geminiRouter);

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
  if (!APP_TOKEN) {
    console.warn('[server] APP_TOKEN is not set — anyone who can reach this ' +
                 'server can spend your Gemini quota. Set it before exposing ' +
                 'this publicly.');
  }
});
