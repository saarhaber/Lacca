# Ground truth for CIELAB / ΔE matching

This document defines how **L\*a\*b\*** values enter the system and when a match is considered acceptable for the Lacca prototype. All product claims about “Perfect Match” (ΔE) must trace to these rules.

## Primary color space

- **CIELAB** under **D65 illuminant** and **2° standard observer** (the default for most paint and cosmetics colorimetry unless otherwise noted).
- Store components as: `L` (0–100), `a` (−128 to 127 typical), `b` (−128 to 127 typical). Persist full precision; round only at display boundaries.

## Allowed sources (in priority order)

1. **Spectrophotometer measurement** of a physical sample (paint chip, leather swatch, OPI bottle chip) with documented geometry (e.g. SCI/SCE, sphere vs 45/0). Preferred for automotive and leather.
2. **Supplier or OEM digital specification** (e.g. paint database LAB) with **documented illuminant/observer**; if not D65/2°, convert and record the conversion in metadata.
3. **Third-party color databases** (e.g. commercial paint libraries) with license, batch date, and **provenance ID**.
4. **Derived from calibrated sRGB** (hex) via a **single documented conversion pipeline** (see `src/color/rgbToLab.ts`). Use only when no direct LAB exists; mark `confidence: "derived"` and expect lower trust for metallics/pearls.

## Freshness and invalidation

- Each LAB record carries `validFrom` / `validTo` (ISO date) when the OEM or supplier may supersede codes (paint rotations, trim changes).
- **Invalidate** or **quarantine** a code when: OEM announces a formula change, batch drift is reported, or ΔE against a new physical sample exceeds the **QA threshold** (see below).

## Per-finish handling

| Finish class | Prototype policy |
|--------------|------------------|
| Solid / non-flake | Full ΔE workflow; `deltaE76` acceptable for v1 ranking. |
| Metallic / pearl | Same math for ranking, but **disclose** that perceived match varies with viewing angle/light; prefer **measurement notes** (`measurement.geometry`) and avoid “perfect” marketing copy without physical QA. |
| Matte / satin | LAB still valid for average color; surface texture is out of scope for v1. |

## QA thresholds (prototype defaults)

These are **internal** gates for releasing a code into `approved` status:

- **ΔE vs physical chip (same code)**: median &lt; 2.0 for solids; &lt; 3.0 for metallic/pearl (document exceptions).
- **Cross-check**: two independent measurements of the same swatch should agree within **ΔE &lt; 1.0** where possible.

## Metadata required on every LAB record

See JSON Schema: [`schemas/lab-measurement-v1.schema.json`](../schemas/lab-measurement-v1.schema.json). Minimum fields: `L`, `a`, `b`, `illuminant`, `observer`, `source`, `confidence`, `recordedAt`.

## Match tiers (product language vs math)

- **Perfect Match (product)**: target **ΔE &lt; 1.0** vs selected reference (see `src/color/deltaE.ts`).
- **Close**: &lt; 2.0; **Explore**: &lt; 4.0 — tune copy separately from math.

All tiers must use the **same** ΔE formula version and illuminant/observer as the catalog entries being compared. The catalog file declares which formula was used (`deltaEVersion`) and the web + demo pipelines pick the matching implementation so math is never inferred.

### ΔE formula versions

- `deltaE76` — CIE76 Euclidean distance. Acceptable for coarse ranking; retained for backward compatibility.
- `deltaE00` — CIEDE2000 (Sharma et al. 2005). Default for OPI catalogs ≥ 1.1.0. Perceptually uniform for small differences in the grey/neutral region — the bulk of automotive paint.

Tier cutoffs (perfect &lt; 1, close &lt; 2, explore &lt; 4) are shared across both formulas today because they remain practical for CIEDE2000. Retune them once enough paired (physical-vs-derived) measurements exist; track as a follow-up.

## Upgrading an OPI SKU from derived to measured

The seed script [`scripts/seed-opi-catalog.ts`](../scripts/seed-opi-catalog.ts) can bootstrap rows; [`scripts/sync-opi-from-opicom.ts`](../scripts/sync-opi-from-opicom.ts) (`npm run sync:opi`) merges the live OPI.com catalog (hex metafields) into a new `data/opi/catalog-x.y.z.json`. Active snapshot is `data/pipeline/catalog-pointer.json`. Rows remain `confidence: "derived"` until measured. To replace a row with a real spectrophotometer reading:

1. Measure the OPI bottle chip under D65 / 2° (sphere geometry SCI preferred).
2. Edit the corresponding entry in the active catalog JSON (see pointer):
   - Set `source` to `"spectro_reread"` (or the instrument name, e.g. `"spectro_xrite_ci64"`).
   - Set `confidence` to `"measured"`.
   - Replace `L`, `a`, `b` with the measured values; keep full precision.
   - Add `measurement.geometry` (e.g. `"sphere_SCI"`) and `measurement.instrument`.
   - Refresh `recordedAt` and, if the formula may rotate, set `validFrom` / `validTo`.
3. Run `npm run validate:data` to confirm the Ajv schema still accepts the row.
4. If you bumped the catalog version, update `data/pipeline/catalog-pointer.json` and `src/pipeline/validateData.ts` (`staticChecks` OPI path).

Prefer landing measured rows in batches per shade family (e.g. all greys, all reds) so any cross-chip bias surfaces during QA rather than in production.
