import {
  deltaEFnForVersion,
  tierFromDeltaE,
  type MatchTier
} from "../../src/color/deltaE.js";
import type { Lab, LabMeasurement } from "../../src/color/types.js";
import type { DeltaEVersion, OpiSku, PaintFinish } from "../../src/pipeline/opiTypes.js";

export type RankedOpi = {
  opi: OpiSku;
  deltaE: number;
  /**
   * Composite score used for ranking. Equals `deltaE` when no finish penalty
   * applies (OPI finish missing, or finishes match). Otherwise `deltaE`
   * plus a perceptual penalty for finish-family mismatch.
   */
  matchScore: number;
  /** ΔE-only tier (not capped) for reference. */
  rawTier: MatchTier;
  /** Effective tier shown to the user (may be capped by source confidence). */
  tier: MatchTier;
  /** True when the source paint's confidence capped the best achievable tier. */
  cappedByConfidence: boolean;
  /** Penalty added to deltaE when the input and OPI finishes disagree. */
  finishPenalty: number;
};

export type RankOptions = {
  deltaEVersion?: DeltaEVersion;
  /** Confidence of the input paint's LAB measurement — used to cap tier. */
  sourceConfidence?: LabMeasurement["confidence"];
  /** Physical finish of the input paint, used for composite scoring. */
  sourceFinish?: PaintFinish;
};

/**
 * Rank OPI SKUs against a paint LAB. The ΔE formula is picked from the
 * catalog's `deltaEVersion` so the JSON file remains the source of truth
 * for which math was used to publish it.
 *
 * When the input paint's `sourceConfidence` is derived or estimated we cap
 * the highest achievable tier at "close" — a color converted from a hex
 * touch-up reference cannot honestly claim a "perfect" match because the
 * base LAB already carries conversion error.
 *
 * When both the input and an OPI SKU carry a `finish`, a finish penalty is
 * added to ΔE to form `matchScore`, and results are sorted by that composite
 * score. ΔE is still reported verbatim so UI copy can cite the color-only
 * number. If OPI finish metadata is missing, penalty is 0 and ranking is
 * unchanged from the color-only path.
 */
export function rankOpiMatches(
  paintLab: Lab,
  skus: OpiSku[],
  topN: number,
  optionsOrVersion: RankOptions | DeltaEVersion = "deltaE76"
): RankedOpi[] {
  const options: RankOptions =
    typeof optionsOrVersion === "string"
      ? { deltaEVersion: optionsOrVersion }
      : optionsOrVersion;
  const deltaEVersion = options.deltaEVersion ?? "deltaE76";
  const deltaE = deltaEFnForVersion(deltaEVersion);
  const cap = shouldCapTier(options.sourceConfidence);

  return skus
    .map((opi) => {
      const de = deltaE(paintLab, opi.lab);
      const finishPenalty = finishPenaltyFor(options.sourceFinish, opi.finish);
      return {
        opi,
        deltaE: de,
        matchScore: de + finishPenalty,
        finishPenalty
      };
    })
    .sort((a, b) => a.matchScore - b.matchScore)
    .slice(0, topN)
    .map((r) => {
      const rawTier = tierFromDeltaE(r.deltaE, deltaEVersion);
      const tier = cap ? capToClose(rawTier) : rawTier;
      return {
        ...r,
        rawTier,
        tier,
        cappedByConfidence: cap && tier !== rawTier
      };
    });
}

function shouldCapTier(c?: LabMeasurement["confidence"]): boolean {
  return c === "derived" || c === "estimated";
}

function capToClose(t: MatchTier): MatchTier {
  return t === "perfect" ? "close" : t;
}

/**
 * Penalty matrix for finish-family mismatch. Values are on the same scale as
 * ΔE so a 1.5 penalty roughly equals "one tier worse". Applied only when
 * both sides have an explicit finish — gated so OPI catalogs without finish
 * metadata behave exactly like the color-only ranking.
 */
const FINISH_PENALTY: Record<PaintFinish, Record<PaintFinish, number>> = {
  solid: { solid: 0, metallic: 1.5, pearl: 1.5, matte: 0.8, other: 0.5 },
  metallic: { solid: 1.5, metallic: 0, pearl: 0.5, matte: 1.5, other: 0.5 },
  pearl: { solid: 1.5, metallic: 0.5, pearl: 0, matte: 1.5, other: 0.5 },
  matte: { solid: 0.8, metallic: 1.5, pearl: 1.5, matte: 0, other: 0.5 },
  other: { solid: 0.5, metallic: 0.5, pearl: 0.5, matte: 0.5, other: 0 }
};

function finishPenaltyFor(source?: PaintFinish, opi?: PaintFinish): number {
  if (!source || !opi) return 0;
  return FINISH_PENALTY[source][opi];
}
