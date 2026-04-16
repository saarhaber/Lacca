import type { Lab } from "./types.js";

/**
 * ΔE*_ab (CIE76) — Euclidean distance in L*a*b*.
 * Must only compare measurements taken under the same illuminant/observer.
 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * ΔE00 (CIEDE2000). Perceptually uniform update to CIE76 that applies
 * lightness, chroma, and hue weighting plus a hue-rotation term.
 *
 * Reference: Sharma, Wu, Dalal, "The CIEDE2000 Color-Difference Formula:
 * Implementation Notes, Supplementary Test Data, and Mathematical Observations",
 * Color Research & Application, 2005. Equation numbering below matches the paper.
 *
 * Inputs must share illuminant/observer (Lacca convention: D65 / 2°).
 * Default weighting factors kL = kC = kH = 1.
 */
export function deltaE00(
  lab1: Lab,
  lab2: Lab,
  kL = 1,
  kC = 1,
  kH = 1
): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const pow25_7 = Math.pow(25, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + pow25_7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = hueDeg(a1p, b1);
  const h2p = hueDeg(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp / 2));

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(hbarp - 30)) +
    0.24 * Math.cos(deg2rad(2 * hbarp)) +
    0.32 * Math.cos(deg2rad(3 * hbarp + 6)) -
    0.2 * Math.cos(deg2rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + pow25_7));
  const SL =
    1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(deg2rad(2 * dTheta)) * RC;

  const termL = dLp / (kL * SL);
  const termC = dCp / (kC * SC);
  const termH = dHp / (kH * SH);

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function hueDeg(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const deg = (Math.atan2(b, a) * 180) / Math.PI;
  return deg >= 0 ? deg : deg + 360;
}

export type DeltaEFn = (lab1: Lab, lab2: Lab) => number;

export type DeltaEFormulaVersion = "deltaE76" | "deltaE00";

/**
 * Automotive-biased parametric weights for CIEDE2000 (kL:kC:kH = 2:1:1).
 * Rationale: metallic and pearl paints average out lightness variation across
 * flake orientation, so penalizing lightness 1:1 with hue overstates the real
 * perceptual miss. Textile and automotive industries commonly use 2:1:1.
 */
export const DELTAE00_AUTOMOTIVE_WEIGHTS = { kL: 2, kC: 1, kH: 1 } as const;

/**
 * Resolve the ΔE function declared in an OPI catalog's `deltaEVersion` field.
 * CIEDE2000 is resolved with automotive weighting (2:1:1) by default so the
 * catalog file remains the single source of truth for which math is used.
 */
export function deltaEFnForVersion(version: DeltaEFormulaVersion): DeltaEFn {
  if (version === "deltaE00") {
    const { kL, kC, kH } = DELTAE00_AUTOMOTIVE_WEIGHTS;
    return (lab1, lab2) => deltaE00(lab1, lab2, kL, kC, kH);
  }
  return deltaE76;
}

export type MatchTier = "perfect" | "close" | "explore" | "distant";

export type TierCutoffs = {
  perfect: number;
  close: number;
  explore: number;
};

/**
 * Tier thresholds differ by formula because CIEDE2000 compresses the scale
 * relative to CIE76 — particularly in chromatic regions — and our automotive
 * 2:1:1 weighting further shrinks lightness-driven differences. A ΔE76 of ~3
 * is typically perceptually closer to a ΔE00 of ~1.5, so CIEDE2000 cutoffs
 * are set about half of the CIE76 cutoffs and should be retuned with paired
 * ground-truth data (tracked in docs/GROUND_TRUTH.md).
 */
export const TIER_CUTOFFS: Record<DeltaEFormulaVersion, TierCutoffs> = {
  deltaE76: { perfect: 1, close: 2, explore: 4 },
  deltaE00: { perfect: 0.5, close: 1, explore: 2 }
};

/**
 * Bucket a ΔE into a tier using formula-specific cutoffs.
 * `version` defaults to `deltaE76` for backward compatibility.
 */
export function tierFromDeltaE(
  de: number,
  version: DeltaEFormulaVersion = "deltaE76"
): MatchTier {
  const c = TIER_CUTOFFS[version];
  if (de < c.perfect) return "perfect";
  if (de < c.close) return "close";
  if (de < c.explore) return "explore";
  return "distant";
}
