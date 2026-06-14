# Ground Truth

The single reference for *what counts as truth* in Lacca: how a color value
earns its confidence, the canonical color-space convention every measurement
must share, and how the ΔE match tiers should be tuned against real paired
samples. Several source files point here (`src/color/deltaE.ts`,
`src/color/types.ts`, `scripts/seed-opi-catalog.ts`, `docs/SOURCES.md`).

## Color-space convention

Every LAB value in this repo — OEM paints and the OPI catalog alike — is
expressed under **CIELAB D65 / 2° observer**. ΔE is only meaningful between
two measurements that share an illuminant and observer, so mixing conventions
is a correctness bug, not a rounding error. The schema records `illuminant`
and `observer` on every measurement so this can be validated rather than
assumed.

## Source-priority ladder

When two sources disagree about a color, prefer the higher-confidence one.
The confidence level is schema-enforced (`schemas/lab-measurement-v1.schema.json`)
and caps the best match tier a paint can achieve.

| Priority | Confidence  | What it means                                                          | Match tier cap |
|----------|-------------|-----------------------------------------------------------------------|----------------|
| 1 (best) | `measured`  | Spectrophotometer reading against the physical chip/panel.            | uncapped       |
| 2        | `spec`      | Authoritative CIELAB from an OEM/refinish paint spec sheet.           | uncapped       |
| 3        | `derived`   | LAB converted from an sRGB hex/RGB — inherently lossy for coated paint.| "close" (no "perfect") |
| 4 (worst)| `estimated` | Hand-picked placeholder until a real measurement lands.               | "close" (no "perfect") |

The tier cap is enforced in `web/src/match.ts`: a `derived` or `estimated`
source can never present an "Excellent/perfect" match, because the underlying
LAB was never read off a physical sample.

### Why `hex_derived` is capped

Most current data is `derived` from published sRGB hex via the standard
sRGB → XYZ → LAB pipeline (`src/color/rgbToLab.ts`). A web hex is an 8-bit,
gamut-clipped, single-angle approximation of a coated automotive finish —
metallic and pearl flake, gonio-apparent color, and clear-coat all collapse
into one triplet. It is good enough to *rank* shades but not to *certify* a
perfect match, hence the cap.

## ΔE formulas and tier cutoffs

Two formulas are supported; the OPI catalog's `deltaEVersion` field is the
source of truth for which one published a given catalog.

- **`deltaE76`** (CIE76) — plain Euclidean distance in LAB.
- **`deltaE00`** (CIEDE2000) — perceptually uniform, resolved with automotive
  parametric weights **kL:kC:kH = 2:1:1** (flake orientation averages out
  lightness, so a 1:1 lightness penalty overstates the perceptual miss).

Tier cutoffs live in `TIER_CUTOFFS` in `src/color/deltaE.ts`:

| Tier      | deltaE76 | deltaE00 (2:1:1) |
|-----------|----------|------------------|
| perfect   | < 2.5    | < 1.5            |
| close     | < 5.0    | < 3.0            |
| explore   | < 8.0    | < 5.0            |
| distant   | ≥ 8.0    | ≥ 5.0            |

These are **calibrated against the live corpus** (≈6,200 OEM paints vs. the
~330-shade OPI catalog), not textbook just-noticeable-difference values. JND
cutoffs (ΔE00 perfect<0.5/close<1/explore<2) are wrong for *cross-product*
matching: a finite polish catalog can't land within JND of an arbitrary car
color, so JND cutoffs dumped ~72% of cars into "distant" and never awarded a
top tier. The values above bucket by where matches actually land — roughly
top-sixth "perfect", about half within "close", a "Good" middle, and a
"distant" tail (≈17%) that is genuine coverage gaps (saturated greens, deep
blues OPI doesn't stock). CIE76 runs ≈1.5–2× larger than the automotive
CIEDE2000, so its cutoffs are scaled up independently. **Retighten once
spectro-measured ground truth exists.**

## Tuning the cutoffs against paired samples

The cutoffs above are seeded from literature, not from Lacca-specific paired
data. To retune them empirically:

1. Collect paired samples: an OEM paint and a known OPI shade that a human has
   judged as "perfect / close / explore / distant" against the real lacquer.
2. Compute both `deltaE76` and `deltaE00` for each pair
   (`scripts/check-delta-e.ts` is the harness; it currently asserts against the
   Sharma et al. 2005 CIEDE2000 reference rows).
3. Pick cutoffs that best separate the human labels per formula, and update
   `TIER_CUTOFFS`.

Until that paired set exists, treat tier labels as a guide, not a guarantee —
which is exactly why `derived` data is capped at "close" regardless of ΔE.

## References

- Sharma, Wu, Dalal, "The CIEDE2000 Color-Difference Formula: Implementation
  Notes, Supplementary Test Data, and Mathematical Observations,"
  *Color Research & Application*, 2005.
- See `docs/SOURCES.md` for where each OEM scope's data actually comes from.
</content>
</invoke>
