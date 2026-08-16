# Kairosphere backend

Exists for one reason: **the Gemini API key must never reach a browser.**

It used to. `vite.config.ts` inlined it via `define`, so the key shipped inside
`dist/assets/*.js` to every visitor. This service is where it lives now.

## Running it

```bash
cd server
npm install
cp .env.example .env      # then put your real key in it
node --env-file=.env index.js
```

Then start the frontend as usual — Vite proxies `/api` to `http://localhost:8787`.

| variable | default | meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(none)* | required; without it AI endpoints return 503 |
| `PORT` | `8787` | listen port |
| `ALLOWED_ORIGINS` | localhost dev origins + `capacitor://localhost` | comma-separated CORS allowlist |
| `RATE_LIMIT_MAX` | `20` | requests per minute per IP |

In production set `VITE_API_BASE_URL` for the frontend build to point at the
deployed server, and set `ALLOWED_ORIGINS` here to match your real origins.

## Why an operation allowlist, not a passthrough

A generic `POST /gemini` that forwards whatever the client sends would keep the
key off the browser — and hand anyone who found the endpoint a free
general-purpose Gemini account billed to this project.

Instead the client names one of a fixed set of operations and supplies only
data. Prompts, models and response schemas live in `routes/gemini.js`.

```
POST /api/ai/precise-location    { title, description }      -> { location }
POST /api/ai/event-image         { title, region, description } -> { dataUrl }
POST /api/ai/verify-ritual-image { image }                    -> VerificationResult
POST /api/ai/pulse-ingest        {}                           -> { event, sourceUrl }
POST /api/ai/scout               { location }                 -> { source, language, rawText }
POST /api/ai/polyglot            { rawText, language }        -> { eventName, location, category }
POST /api/ai/fact-check          { eventName, location }      -> { verified, confidence, sourceUrls }
POST /api/ai/geocode             { location }                 -> { lat, lng }
POST /api/ai/live-token          { title, type, etiquette }   -> { token, model, config }
GET  /api/ai/operations                                       -> { operations: [...] }
GET  /health                                                  -> { ok, aiConfigured }
```

`aiConfigured` reports *whether* a key is set. It never reports any part of it.

## The Live API exception

`WhisperOverlay` streams bidirectional audio over a WebSocket. No REST proxy
can sit in front of that, so `/api/ai/live-token` mints an **ephemeral token**
with the real key: single use, expiring in ~60 seconds if unspent, ~30 minutes
once open, and bound to the audio model.

The narration persona is composed server-side from the event data the client
sends and locked into the token, so a caller cannot substitute its own system
instruction. The endpoint returns the exact config the token is bound to, and
the client passes it to `live.connect()` verbatim.

## Defences in place

- Named-operation allowlist; unknown operations 404.
- User strings are stripped of control characters, whitespace-collapsed, and
  capped at 600 characters before interpolation. Every operation that accepts
  free text also constrains the output with a response schema, so a hostile
  string has little room to work with. This is mitigation, not a guarantee —
  treat model output as untrusted.
- 8MB JSON body cap; images additionally capped at 6MB base64.
- Per-IP rate limit, in memory. Swap for a shared store before running more
  than one instance.
- CORS origin allowlist; disallowed origins get 403.
- Upstream errors are logged in full but returned in outline. A raw SDK error
  can carry the request URL, which embeds the key.

## Not done yet

- **No authentication.** Any client that can reach the server can spend your
  quota, just not steal the key. Put auth or a gateway in front of it before
  exposing it publicly.
- The rate limiter is per-process and resets on restart.
- No cost tracking or per-operation quotas.
