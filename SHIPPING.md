# Shipping Kairosphere

What has to be true before a release, and what is still open. Written during
the pre-ship pass so the next person — including future you — does not have to
rediscover it.

## Before any public deploy

- [ ] **Rotate the Gemini key.** One was pasted into a chat transcript during
      development. Generate a new one at
      [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — it
      begins `AIza`. A key beginning `AQ.` is an OAuth token and will be
      rejected by the `generativelanguage` endpoint.
- [ ] `GEMINI_API_KEY` set in **three** places as needed: `.env` (local
      pipeline), the `GEMINI_API_KEY` GitHub secret (scheduled runs), and
      `server/.env` (the app's own AI features).
- [ ] **`APP_TOKEN` set on the server and `VITE_APP_TOKEN` in the build.**
      Without it anyone who finds the endpoint can spend your Gemini quota.
      The server warns at boot when it is missing.
- [ ] `ALLOWED_ORIGINS` set to your real origins, keeping `https://localhost`
      and `capacitor://localhost` — the mobile app needs both.
- [ ] Confirm no `.env` is tracked: `git ls-files | grep -E '\.env$'` returns
      nothing.

## Mobile build

The packaged app has no dev proxy and no guarantee of network, so two
variables are **required** rather than optional:

```bash
VITE_API_BASE_URL=https://api.example.com \
VITE_PHENOMENA_URL=https://user.github.io/repo/data/phenomena.json \
VITE_APP_TOKEN=... \
npm run build && npx cap sync android
```

- [ ] Without `VITE_API_BASE_URL` the app requests `https://localhost/api/...`
      — its own bundled assets — and every AI feature 404s.
- [ ] Without `VITE_PHENOMENA_URL` the app ships a feed frozen at build time
      that only ever decays.
- [ ] Android launcher icons: Capacitor uses `android/app/src/main/res`, which
      is separate from the web manifest. Generate them from `public/icon.svg`.
- [ ] Check the feed, the map switch and the Plan tab on a real device. The
      phone gets a different shell from the desktop — a ranked list as home,
      three tabs, filters in a sheet, and no globe — so testing the desktop
      layout in a narrow window does not exercise it.

## Known open items

**Not blocking, but you should know before you ship.**

- **The globe fetches Earth textures from unpkg** at runtime. Offline, or with
  the CDN blocked, it fails. Bundling them adds a few MB to the app. It is no
  longer mounted on phone-width viewports at all, so this affects desktop
  only — and saves mobile the 518 kB gzipped chunk as a side effect.
- **The app still assumes a network in several places.** For a reader in
  Sumba or the Danakil with no signal — exactly when the app is most useful —
  the catalogue is static and small enough to ship entirely offline, but the
  Wikipedia extracts, Open-Meteo lookups and Commons photographs are all
  fetched live. Nothing caches them for a saved event.
- **152 of 373 events have no verified photograph.** They keep their original
  image. Re-run `python -m pipeline.images` to pick up newly-added Commons
  material; it is resumable and only tries unmapped ids.
- **Keyword matching produced one genuinely harmful photograph.** Crow Fair,
  an Apsáalooke powwow, was illustrated with a Jim Crow segregation cartoon:
  the matcher accepted "crow" for the subject and "united" — from United
  States — as the place. Both matched, neither meant anything. The rule now
  rejects generic country words as corroboration, and a test asserts the
  shipped mapping contains no others. **Review new matches before shipping
  them**; a wrong photograph on a cultural event is worse than none.
- **133 events carry a placeholder date** (`2026-05-01` from a bulk import).
  They are flagged and the UI says "Date not confirmed" rather than inventing
  a day, but they are not usable for planning until someone sources real
  dates.
- **The Southeast Asia entries are written from general knowledge.** Real
  coordinates, representative dates, lunar ones flagged as varying — but the
  fixed dates deserve checking against official sources before you sell a trip
  on them.
- **USA-NPN is wired but unverified.** It times out; the adapter fails soft.
- **Crowd verification is designed but not built.** It needs a write path and
  an audience. `pipeline/verification.py` stands in for it meanwhile.
- **Triwara in `pipeline/pawukon.py` is unverified.** Structurally right,
  phase unconfirmed; nothing published depends on it.
- **`Abu Simbel Sun Fest` and `Abu Simbel Sun Festival`** are a duplicate pair
  the deduper missed — the titles differ enough to clear the similarity check.
  Worth a manual sweep for others like it.

## Release checks

```bash
npm run typecheck                                   # must be clean
python -m unittest discover -s pipeline/tests -t .  # 33 tests
npm run build
python -m pipeline.run --dry-run                    # feed still builds
python -m pipeline.check_ai                         # key actually works
```

- [ ] Typecheck clean. It only became meaningful once `@types/react`,
      `@types/react-dom` and `@types/leaflet` were installed — before that the
      React surface was entirely untyped.
- [ ] The scheduled workflow is green and the publish gate is passing. A
      failed run means the feed was *not* replaced, which is the intended
      behaviour, not a silent success.
- [ ] `python -m pipeline.monitor --country ID --all` reports non-zero
      "withheld as private" and "dropped as noise". Both zero means the
      classifier is not running.

## Things that are deliberately not automated

- **Sacred content never publishes.** `curated_events.json` carries a
  deliberately sacred-marked entry as a live canary, and a test asserts it
  never reaches output. If that test fails, stop.
- **Tier 4 dates never auto-publish.** A human sets `reviewStatus`, and stale
  entries surface in `pipeline/out/review_queue.json` before their window
  opens.
- **The local-news feed refuses to render unfiltered.** Without the classifier
  it marks itself `unfiltered` and the client shows nothing, rather than
  dumping raw headlines that have not been checked for being somebody's
  private funeral.
