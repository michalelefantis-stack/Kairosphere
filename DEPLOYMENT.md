# Deployment checklist

Ordered by what stops a launch, not by effort. `SHIPPING.md` holds the long
explanations; this is the list to tick.

Audited 18 Aug 2026 against the working tree.

---

## 1 — Blockers

Nothing ships until these are true.

- [ ] **Create the GitHub remote and push.** `git remote -v` is empty. Every
      content-update path in this app runs through GitHub: the feed workflow
      has never executed once, so the live map is only as fresh as the last
      manual pipeline run. This is the single highest-value item on the list —
      it turns a static build into a product that maintains itself.
- [ ] **Rotate the Gemini key.** One was pasted into a chat transcript during
      development. New key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey);
      it begins `AIza`, not `AQ.`.
- [ ] **Set `GEMINI_API_KEY` in two places** — `.env` (local pipeline) and the
      `GEMINI_API_KEY` GitHub secret (scheduled runs). A third, `server/.env`,
      only if you deploy the server.
- [ ] **Decide whether to deploy the server at all.** It now serves one
      operation: `preciseLocation`, which sharpens "Montana, United States" to
      "Crow Agency, Montana". Skipping it is supported — the panel falls back
      to the catalogue's own region, which is already correct — and it removes
      a deployment target, a public endpoint and a quota risk. The three items
      below only apply if you deploy it.
  - [ ] `APP_TOKEN` on the server and `VITE_APP_TOKEN` in the build. Without
        it, anyone who finds the endpoint spends your Gemini quota.
  - [ ] `ALLOWED_ORIGINS` set to the real origins, keeping `https://localhost`
        and `capacitor://localhost` — the mobile app needs both.
  - [ ] `GEMINI_API_KEY` in `server/.env`.
- [ ] **Pick hosting and add its config.** There is no `vercel.json`,
      `netlify.toml`, `firebase.json` or `Dockerfile`. Without the server this
      is one static host for `dist/` and the data; any of Cloudflare Pages,
      Netlify, Vercel, Firebase Hosting or S3 will do, and putting the data on
      the same origin removes the CORS question entirely.
- [ ] **Enable GitHub Pages for the data feed** — repo variable
      `PUBLISH_PAGES=true`, Settings → Pages → Source: GitHub Actions. This is
      what `VITE_PHENOMENA_URL` and `VITE_CONTENT_BASE_URL` point at.
- [ ] **Set `VITE_CONTENT_BASE_URL` and `VITE_PHENOMENA_URL` in the build.**
      Omit them and the app reads its bundled copies — which means a wrong
      photograph or a corrected date needs a full release instead of a file
      upload.
- [ ] **Confirm no `.env` is tracked:** `git ls-files | grep -E '\.env$'`
      returns nothing.
- [ ] **Lock down Firestore rules.** `firebase-applet-config.json` is checked
      in; its `apiKey` is a public client identifier and that is fine, but the
      database behind it must not be world-writable.
- [x] ~~**Add `public/og-image.png`.**~~ Built at 1200x630 by
      `python scripts/make_og_image.py`, which reads the counts from the
      catalogue and writes them into index.html's meta tags in the same run —
      so re-running after a content change keeps the card and the description
      honest. It also corrected two claims that were already false: "340+
      events" against a catalogue of 327, and "AI-powered analysis", which
      nothing in the app does any more.

---

## 2 — Content accuracy

The product is sold on knowing *when* something happens. These are the gaps
between that promise and the data.

- [ ] **82 events sit on the `2026-05-01` bulk-import placeholder.** Flagged in
      the UI as unconfirmed rather than invented, so nothing lies — but they
      cannot carry a trip. Source real dates or cut them.
- [ ] **59 of 327 events have no verified photograph.** The category glyph
      stands in. `python -m pipeline.lead_images` is the higher-yield path;
      review what it adds before shipping it.
- [ ] **116 of 327 have no sourced briefing.** 11 of those also have a
      catalogue description under 120 characters — those 11 are the thin ones
      a reader will actually notice.
- [ ] **Verify the 50 hand-written natural phenomena.** Three rounds of
      automated matching failed on them, and failed dishonestly. Accurate as
      far as they go; not sourced.
- [ ] **Verify the Southeast Asia fixed dates** against official sources. Real
      coordinates and representative dates, lunar ones flagged — but written
      from general knowledge.
- [ ] **Review the 155 galleries.** 595 frames, none shared between events,
      none repeating a lead image — but the article path is only as good as
      its filter, and that filter has been wrong twice.

---

## 3 — Mobile

- [ ] **Build with all four variables set**, not just the two:
      `VITE_API_BASE_URL`, `VITE_PHENOMENA_URL`, `VITE_CONTENT_BASE_URL`,
      `VITE_APP_TOKEN`. Then `npx cap sync android`.
- [ ] **Android launcher icons.** Capacitor reads
      `android/app/src/main/res`, which the web manifest does not touch.
      Generate from `public/icon.svg`.
- [ ] **Native sign-in, or ship without accounts deliberately.**
      `signInWithPopup` cannot work in the Capacitor WebView; Google and Apple
      both fail silently today. Needs `@capacitor-firebase/authentication`
      plus console work — see `SHIPPING.md`.
- [ ] **Test on a real device.** The phone shell is a different app: ranked
      feed as home, three tabs, filters in a sheet, no globe. A narrow desktop
      window does not exercise it.
- [ ] **Privacy policy URL.** The app asks for location. Both stores require
      one before review, and there is nothing to point at yet.

---

## 4 — Worth doing, not blocking

- [ ] **The globe pulls Earth textures from unpkg at runtime.** Offline or with
      the CDN blocked it fails. Desktop only — it is not mounted on phones.
- [ ] **1.8 MB `GlobeComponent` chunk** (518 kB gzipped) — now the only
      oversized one. Already lazy-loaded and phone-excluded, so it costs only
      desktop users who open it.
- [ ] **Nothing caches for offline.** The catalogue ships in the bundle, but
      Wikipedia extracts, Open-Meteo lookups and Commons photographs are all
      live — for a reader in Sumba with no signal, which is when this app is
      most useful.
- [ ] **No error monitoring.** `ErrorBoundary` catches and shows; nothing
      reports. A crash in the field is currently invisible to you.
- [ ] **Video.** It belongs — spectacle is the selling point — but resolved
      once into static data and reviewed, like the photographs. Never a live
      search: that is how a Jim Crow cartoon reached an Apsáalooke powwow.
- [ ] **Affiliate ids.** Flights and stays hand off to Google Flights and
      Booking.com untagged; the Bookshop links carry no partner id. All three
      URLs are built in one place each, so adding tags touches no component.
- [ ] **Only 3 of 327 events have a real `tourLink`.** The rest fall back to a
      TourRadar region search. High-margin operators for Gerewol, Naghol and
      Takanakuy are the business case — they need finding by hand.

---

## Already true

Verified in this pass, so nobody re-checks them.

- [x] `npx tsc --noEmit` clean, `npm run build` clean.
- [x] 33 pipeline tests pass.
- [x] `.gitignore` covers `.env`, keys, build output and the prompt-history
      export.
- [x] Feed workflow written, tested and scheduled every two hours — it only
      needs a remote to run against.
- [x] Catalogue moved to fetched JSON, so adding or correcting an event is a
      content change rather than a release.
- [x] All 327 events resolve to arrival and gateway airports.
- [x] No `TODO`/`FIXME` left in application code.
- [x] Dead `BottomPanel` removed; scrollbar CSS defined once.
- [x] The unreachable AI surface removed — a generated event image, a live
      audio narration, a ritual-photo verifier and a four-stage scouting
      agent, none of which any user could reach. Took a 272 kB chunk and four
      server endpoints with it.
- [x] No `<img src="">` anywhere. Ten calendar cards had one, which makes the
      browser re-request the page.
