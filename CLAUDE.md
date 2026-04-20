# Lacca — Agent Context

**What this repo is:** A paint-color matching app. Users pick a car make/model and the app finds the closest OPI nail polish shade using CIE ΔE color distance. Live at https://saarhaber.github.io/Lacca/

---

## Repo layout

```
src/          Core TypeScript library (color math, pipeline helpers)
scripts/      CLI scripts for data collection, seeding, validation
web/          Vite web app (src/main.ts is the entry point)
data/oem/     OEM paint scopes — one folder per make+source combination
data/opi/     OPI nail polish catalog
data/sources/ Raw downloaded source data (ACL JPEGs, PaintRef HTML cache, vPIC JSON)
schemas/      JSON Schema for all data files
docs/         Project documentation
```

---

## Data model

Every OEM scope lives at `data/oem/<slug>-<source>-v1/` and contains two files:

- **`oem-scope.json`** — metadata: `scopeId`, `oem`, `modelYears`, `models[]`
- **`exterior-paints-v1.json`** — paint rows: `code`, `marketingName`, `finish`, `lab` (L/a/b, illuminant, observer, confidence, source, provenanceId)

### Scope source types

| Suffix | Meaning |
|--------|---------|
| `-paintref-v1` | Scraped from paintref.com (large historical catalogs) |
| `-autocolorlibrary-v1` | OCR-extracted from autocolorlibrary.com chip images |
| `-curated-v1` | Hand-curated entries (user-supplied or from industry sources) |
| `-vpic-v1` | NHTSA vPIC model catalog only — `paints: []` empty, provides model lists for UI dropdowns |

### Confidence levels (schema-enforced)

| Confidence | Source | Match tier cap |
|------------|--------|---------------|
| `measured` | Spectrophotometer on physical chip | Uncapped |
| `spec` | OEM/refinish LAB spec sheet | Uncapped |
| `derived` | Converted from sRGB hex | "close" (no "perfect") |
| `estimated` | Placeholder | "close" |

Almost all current data is `derived`. The match-tier cap is enforced in `web/src/match.ts`.

---

## Key scripts

| Script | Purpose |
|--------|---------|
| `validate-data.ts` | Validate all scopes against JSON Schema. Run after any data change. |
| `fetch-paintref-all.ts` | Batch-fetch OEM paint data from paintref.com |
| `acl-tesseract-batch.ts` | OCR pipeline for autocolorlibrary.com chip images |
| `acl-sanitize-autocolorlibrary-scopes.ts` | Fix garbled OCR names in -autocolorlibrary-v1 scopes |
| `import-autocolorlibrary-labels.ts` | Import ACL label JSON into OEM scopes |
| `merge-oem-scopes.ts` | Merge multiple source scopes into one canonical scope |
| `seed-vpic-all-oems.ts` | Populate vPIC model-catalog stubs for all major OEMs |
| `demo-match.ts` | Smoke test the color matching pipeline |
| `check-delta-e.ts` | Run ΔE calculations across the paint catalog |
| `import-kaggle-csv.ts` | Import paint data from CSV (supports direct LAB columns → `spec` confidence) |

Run any script: `npx tsx scripts/<name>.ts [flags]`

---

## Adding paint data manually

1. Compute LAB from hex using the standard sRGB→XYZ→LAB pipeline (see `src/color/rgbToLab.ts`).
2. Add to an existing scope's `exterior-paints-v1.json` or create a new `-curated-v1` scope.
3. Run `npx tsx scripts/validate-data.ts` to confirm schema compliance.

New curated scopes need both files. Use this minimal template:

```json
// oem-scope.json
{
  "$schema": "../../../schemas/oem-scope-v1.schema.json",
  "scopeId": "<slug>-curated-v1",
  "oem": "Make Name",
  "region": "Global",
  "modelYears": { "from": 2010, "to": 2026 },
  "models": ["Model A", "Model B"],
  "notes": "...",
  "exteriorPaintFile": "./exterior-paints-v1.json"
}

// exterior-paints-v1.json
{
  "$schema": "../../../schemas/exterior-paints-v1.schema.json",
  "scopeId": "<slug>-curated-v1",
  "version": "1.0.0",
  "paints": [
    {
      "code": "CODE",
      "marketingName": "Color Name",
      "finish": "solid|metallic|pearl|matte|other",
      "lab": {
        "L": 0.0, "a": 0.0, "b": 0.0,
        "illuminant": "D65", "observer": "2deg",
        "source": "hex_derived", "confidence": "derived",
        "recordedAt": "YYYY-MM-DD",
        "notes": "Derived from #RRGGBB.",
        "provenanceId": "lacca:user-curated:<oem>:<Color-Name>"
      }
    }
  ]
}
```

---

## Web app

Entry point: `web/src/main.ts` — loads all OEM scopes via `import.meta.glob`, builds the make/model picker, runs ΔE matching against the OPI catalog.

```bash
npm run dev:web      # local dev server
npm run build:web    # production build → web/dist/
npm run preview:web  # preview production build
```

Deploy: push to `main` → GitHub Actions auto-builds and publishes to GitHub Pages.

---

## PaintRef status (as of 2026-04-19)

The `colordata.cgi` and `colorcodedisplay.cgi` endpoints return **HTTP 503/508** consistently. Static-shtml cache exists for 19 OEMs under `data/sources/paintref/static-shtml/`. Use `--static-only` flag when running `fetch-paintref-all.ts` to use the cache instead of live requests.

---

## Coverage quick-check

```bash
# Count paints per scope
for f in data/oem/*/exterior-paints-v1.json; do
  printf '%5s %s\n' "$(python3 -c "import json; print(len(json.load(open('$f')).get('paints',[])))")" "$f"
done | sort -n

# Validate everything
npx tsx scripts/validate-data.ts
```

See `docs/OEM-COVERAGE.md` for the full coverage matrix.
