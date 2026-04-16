# Paint Color Sources

This document captures the reality of where Lacca gets factory exterior
color data, the confidence level each source can honestly produce, and the
recommended upgrade path when you want a "perfect" tier ΔE match rather
than the "close" cap that hex-derived data imposes.

See `docs/GROUND_TRUTH.md` for the canonical source-priority ladder and
confidence definitions.

## Confidence ladder (schema-enforced)

`schemas/lab-measurement-v1.schema.json` enforces one of:

| Confidence  | What it means                                                         | Match tier cap |
|-------------|-----------------------------------------------------------------------|----------------|
| `measured`  | A spectrophotometer reading against the actual chip/panel.            | uncapped       |
| `spec`      | Authoritative CIELAB from an OEM/refinish paint spec sheet.           | uncapped       |
| `derived`   | LAB converted from an sRGB hex/RGB — inherently lossy for coated paint.| "close" (no "perfect") |
| `estimated` | Hand-picked placeholder until a real measurement lands.                | "close" (no "perfect") |

The match cap is enforced in `web/src/match.ts` (`shouldCapTier`): ranking
an OPI catalog against a `derived` paint can never surface a "perfect"
label because the source LAB already carries a display-math round-trip.

## Current status of machine-readable sources

| Source                                     | Status (2026-04)           | Best confidence achievable |
|--------------------------------------------|----------------------------|-----------------------------|
| PaintRef (`colordata.cgi` JSON + advanced-search HTML fallback) | JSON is intermittent. Fetchers support `--mode auto\|json\|advanced`, paginate `colorcodedisplay.cgi` with `rows=200&page=N`, and accept `--filter-model`, `--keywords`, `--year`, and `--scan-years` filters. Per-row we capture `year`, `make`, `model`, `code`, `name`, and `hex`; models are aggregated per paint code and surfaced in `ScopeMeta.models`. PaintRef can still return transient `508 Insufficient Resource` rate-limit pages, so we retry up to 3× with backoff. | `spec` when LAB is present; otherwise `derived` |
| NHTSA vPIC `GetAllColors`                  | **Endpoint returns 404.** The script still works against any previously cached response at `data/nhtsa/colors-cache.json`. | `derived` via `NHTSA_HEX_MAP` |
| CarAPI `/api/colors`                       | Commercial. Requires a Bearer token.    | `derived` (hex/RGB)        |
| Kaggle / OEM CSV dumps                     | Live; bring your own file. The CSV importer accepts direct CIELAB columns (`lab_L`/`lab_a`/`lab_b`) to emit **`spec` confidence** rows. | `spec` with LAB columns; `derived` without |
| R-M Color Explorer (BASF)                  | Free web UI, no public API. Can be exported manually, then imported via CSV. | `spec`                      |
| Glasurit Color Online (BASF)               | Free web UI, no public API. Same CSV pathway. | `spec`                      |
| Axalta Historical Color Library            | Free web UI, no public API. Same CSV pathway. | `spec`                      |
| PPG PaintIt                                | Free web UI, no public API. Same CSV pathway. | `spec`                      |
| Hand-curated seeds (`scripts/seed-oem-paints.ts`, `scripts/seed-ral-classic.ts`) | Always works.                       | `derived` unless upgraded   |

Practical consequence: today the only way to hit **`spec` confidence at
scale** is to populate a CSV from one of the refinish databases above and
run `npm run import:csv` with the CIELAB columns. Hex-based flows will top
out at `derived` and therefore at the "close" tier.

## The pipeline

```
                ┌─────────────────────────────┐
                │  External sources           │
                │  (CSV, PaintRef*, NHTSA*,   │
                │   CarAPI, curated seeds)    │
                └──────────────┬──────────────┘
                               │
                               ▼
              scripts/lib/paintref.ts (cached)
              scripts/fetch-*.ts / import-kaggle-csv.ts
                               │
                               ▼
           data/oem/<scope-id>/          ← one folder per raw source
             oem-scope.json              (models may be [] for raw scopes)
             exterior-paints-v1.json
                               │
                               ▼
              scripts/merge-oem-scopes.ts
              scripts/fetch-all-colors.ts
                               │
                               ▼
           data/oem/<slug>-all-v1/       ← canonical merged scope
             supersedes: [raw, raw, …]   (hides raw inputs in the UI)
                               │
                               ▼
              src/pipeline/validateData.ts
                      (auto-discovery)
                               │
                               ▼
                       web/src/main.ts
                 (Vite import.meta.glob;
                  filters out superseded
                  and empty-models scopes)
```

Per-code winners in the merge step are picked by:

1. Highest `confidence` (`measured` > `spec` > `derived` > `estimated`).
2. Source priority as tiebreaker (`spectro_reread` > `oem_spec` > `pantone`
   > `ral_classic` > `paintref` > `third_party_db` > `nhtsa_vpic` >
   `carapi` > `paintref_hex` > `hex_derived` > `placeholder_prototype`).
3. Longer marketing name as a last resort.

Every winner retains its `source`, `provenanceId`, and `notes`, and a
`[merge: chose X over Y]` trace is appended so you can audit decisions.

## Commands

| Command                           | Purpose                                                              |
|-----------------------------------|----------------------------------------------------------------------|
| `npm run fetch:paintref`          | Fetch a single OEM from PaintRef (cached 30 days).                   |
| `npm run fetch:paintref:all`      | Batch-fetch every OEM in `PAINTREF_OEMS` (polite, concurrent, cached). |
| `npm run fetch:nhtsa`             | NHTSA vPIC name → hex → LAB pipeline (uses cache).                   |
| `npm run fetch:carapi`            | CarAPI by year/make/model (requires token).                          |
| `npm run import:csv`              | Import from a CSV; auto-detects columns incl. optional LAB.          |
| `npm run seed:oem`                | Hand-curated hex seeds (Porsche / Toyota / BMW sample).              |
| `npm run seed:ral`                | RAL Classic reference scope (hex today; swap in LAB to upgrade).     |
| `npm run merge:oem`               | Merge N source scopes into a canonical one by confidence.            |
| `npm run fetch:all`               | Run every available source for each OEM and merge into `<slug>-all-v1`. |
| `npm run validate:data`           | Validate every discovered scope against the JSON Schema.             |

## Adding a new source

1. Write a fetcher under `scripts/fetch-<source>.ts` (or a CSV and use the
   existing importer).
2. Emit `ColorSeed[]` via `writeScope` — set the appropriate `source` and
   `confidence` on each seed. If the source gives you LAB, pass `lab`;
   passing only `hex` forces `derived`.
3. Pick a `scopeId` of the form `<slug>-<source>-v1` so the merger can
   recognize it as a raw source distinct from the canonical `<slug>-v1`
   or `<slug>-all-v1` outputs.
4. Keep `models: []` on raw-source scopes so the UI doesn't show them
   directly — they exist to feed the merger.
5. Add the source to `SOURCE_PRIORITY` in
   `scripts/merge-oem-scopes.ts` and `scripts/fetch-all-colors.ts` so the
   merger can rank it correctly.
