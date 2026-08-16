# Kairosphere

A map of extraordinary things happening on Earth right now — traditional rituals,
animal migrations, blooms, and atmospheric phenomena — with an honest answer to
the only question that matters for a trip: *is it actually happening, and how
sure are we?*

Every event carries a predicted window, an uncertainty band, a confidence score,
when it was last verified, and its sources.

## Layout

| path | what it is |
| --- | --- |
| `App.tsx`, `components/`, `utils/` | React + Vite frontend |
| `pipeline/` | Python feed builder — four source tiers and a confidence engine ([docs](pipeline/README.md)) |
| `server/` | Node backend that keeps the Gemini key out of the browser ([docs](server/README.md)) |
| `public/data/` | the generated feed the app reads |
| `android/` | Capacitor wrapper |

## Running it

```bash
npm install
npm run dev                     # http://localhost:3000
```

For AI features (image generation, the Whisper narration, signal intelligence),
also run the backend — the frontend proxies `/api` to it:

```bash
cd server && npm install
cp .env.example .env            # add your Gemini key
node --env-file=.env index.js
```

To rebuild the live-events feed:

```bash
pip install -r pipeline/requirements.txt
python -m pipeline.run
```

| command | does |
| --- | --- |
| `npm run dev` | frontend dev server |
| `npm run build` | production build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run pipeline` | rebuild the feed |
| `npm run pipeline:dry` | show what the feed *would* contain |
| `python -m unittest discover -s pipeline/tests -t .` | pipeline tests |

## Configuration

Copy `.env.example` to `.env.local`. Both variables are optional for web dev and
**required for a correct mobile build** — see below. No secret ever belongs in
this file; anything `VITE_*` is compiled into the bundle and is public.

| variable | purpose |
| --- | --- |
| `VITE_API_BASE_URL` | where the AI backend lives. Blank works in web dev (Vite proxies `/api`). |
| `VITE_PHENOMENA_URL` | where the published feed lives. Blank falls back to the bundled copy. |

## Building for mobile

Capacitor sets `androidScheme: 'https'`, so the packaged app runs at the origin
`https://localhost`. Two consequences that do not show up in a browser:

1. **There is no dev proxy.** With `VITE_API_BASE_URL` blank, the app requests
   `https://localhost/api/ai/...` — its own bundled assets — and 404s. Set it to
   your deployed backend before building.
2. **The bundled feed freezes at build time.** `public/data/phenomena.json` is
   copied into the APK, so without `VITE_PHENOMENA_URL` a released build shows a
   feed that only ever decays. Set it and the app refreshes over the network,
   keeping the bundled copy as the offline fallback for a first launch with no
   signal.

The backend's CORS allowlist must include the app's origin. The defaults already
cover `https://localhost` (Android) and `capacitor://localhost` (iOS); if you set
`ALLOWED_ORIGINS` yourself, keep them.

```bash
VITE_API_BASE_URL=https://api.example.com \
VITE_PHENOMENA_URL=https://user.github.io/kairosphere/data/phenomena.json \
npm run build && npx cap sync android
```

The app picks whichever feed is newest — network, cached, or bundled — so it
degrades gracefully rather than going blank offline.

## How the feed stays current

`.github/workflows/phenomena.yml` rebuilds it every two hours, runs the pipeline
tests first, and passes the result through a publish gate that refuses to replace
a good feed with a collapsed one. See [pipeline/README.md](pipeline/README.md).
