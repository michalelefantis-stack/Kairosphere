# Phenomena pipeline

Turns the "when is this actually happening?" problem into one normalized feed
with a confidence score attached to every claim.

```bash
pip install -r pipeline/requirements.txt
python -m pipeline.run                 # build the feed
python -m pipeline.run --dry-run       # print what it would write
python -m pipeline.run --offline       # tier 1 + 4 only, no network
python -m pipeline.run --horizon-days 60
```

Writes:

| file | what it is |
| --- | --- |
| `public/data/phenomena.json` | the feed the app reads |
| `public/data/live_events.geojson` | compatibility feed for the older loader in `utils/gdeltService.ts` |
| `pipeline/out/review_queue.json` | curated entries a human needs to look at |

## Why four tiers

Different phenomena are knowable in fundamentally different ways, and one
pipeline that pretends otherwise produces confident nonsense. Each tier has its
own method, its own ceiling on confidence, and its own decay rate.

| tier | method | ceiling | half-life | examples |
| --- | --- | --- | --- | --- |
| 1 deterministic | astronomy + calendar math, computed offline | 1.00 | never decays | equinoxes, meteor showers, Ashura, Diwali, Lunar New Year |
| 2 model feeds | published scientific models | 0.90 | 3 days | NOAA aurora, growing-degree-day blooms |
| 3 citizen science | aggregated observation density | 0.75 | 7 days | morels, monarchs, salmon runs |
| 4 curated | a person confirmed it and signed the date | 0.85 | 120 days | Naghol, Gerewol, Goroka Show |

Tier 1 is where to add breadth cheaply: it needs no upstream, never rate-limits,
and never goes stale. It is what keeps the map non-empty.

## The confidence engine

`pipeline/confidence.py` multiplies four factors and clamps to the tier ceiling:

```
confidence = base x decay x corroboration x spread   (capped at the tier ceiling)
```

- **decay** — exponential on days since `last_verified_at`. This is the piece
  that fixes a stale map: an entry nobody re-verifies fades on its own instead
  of sitting there looking authoritative.
- **corroboration** — +12% per doubling of independent sources, capped at 1.3x,
  and only for tiers where agreement means anything (a second opinion on the
  date of an equinox is not evidence).
- **spread** — a hyperbolic penalty on `uncertainty_days`. A month-wide "sometime
  in September" reads as a weaker claim than a ticketed three-day festival.

Every score is explainable:

```python
from pipeline.confidence import score
print(score(event).explain())
# base 0.90 x decay 1.00 x sources 1.00 x spread 0.87 -> 0.78 (ceiling 1.00)
```

The frontend re-applies decay against the wall clock in
`utils/phenomenaService.ts`, so a feed that stopped refreshing degrades in the
UI rather than showing yesterday's certainty.

## Reconciliation

When two sources describe the same phenomenon, `reconcile()` merges them: the
higher tier keeps its window (a computed equinox beats a blog's guess at it),
the loser contributes its source as corroboration, and the stricter sensitivity
setting always wins.

## Ethics, enforced in code

The registry marks each curated entry `public`, `restricted`, or `sacred`.

- **sacred** entries never publish. Not filtered downstream, not a UI toggle —
  `curated.fetch()` drops them and `phenomenaService.ts` refuses them again on
  the client. `curated_events.json` contains one deliberate sacred entry as a
  live test: if it ever reaches the map, the gate is broken.
- **restricted** entries are forced to regional or country precision, whatever
  the registry says, and the UI prints the coordinate at matching precision
  instead of four false decimals.
- Nothing in tier 4 auto-publishes. `reviewStatus` must be `published`, set by
  a human, and stale entries surface in the review queue *before* their window
  opens rather than after they have been wrong in public.

## Adding sources

Adapters live in `pipeline/sources/` and expose `fetch() -> list[PhenomenonEvent]`.
The orchestrator catches per-adapter exceptions, so a dead upstream degrades one
layer instead of failing the run.

Data that changes without code changes lives in `pipeline/registry/`:

- `bloom_models.json` — GDD thresholds per site. `calibrationStatus` is read by
  the engine: anything not `fitted` publishes at 80% of its base confidence.
  **Refitting these against historical bloom records is the highest-value
  improvement available** — they are currently literature estimates.
- `citizen_watch.json` — taxa and regions to track on iNaturalist.
- `curated_events.json` — the human-verified registry.

## Known gaps

- **USA-NPN is wired but unverified.** `services.usanpn.org` timed out from the
  machine this was written on. The adapter fails soft and contributes nothing
  until it answers; the call shape needs checking against a live response.
- **Observation-effort bias in tier 3.** iNaturalist density reflects where
  people *are* as much as where the phenomenon is. Tortuguero green turtles
  derive a window from tourist-season sightings rather than nesting counts,
  which is why that entry currently reads out of season in August. Weighting
  observations against baseline regional activity would fix it.
- **Bloom thresholds are first-pass**, as flagged above.
- **Chinese New Year** uses the second-new-moon rule and does not model the
  leap-month exception that shifts it to the third new moon in rare years.
- **Islamic dates** use tabular reckoning; local crescent sighting moves
  observance by up to a day, which is encoded as `uncertainty_days=1.5` rather
  than hidden.

## Scheduling

Deterministic entries need rebuilding roughly monthly; model feeds go stale in
days. A reasonable cron:

```
*/30 * * * *  cd /path/to/kairosphere && python -m pipeline.run
```

Nothing breaks if it runs less often — the confidence just visibly decays,
which is the point.
