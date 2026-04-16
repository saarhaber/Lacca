import { deltaE76, tierFromDeltaE, type MatchTier } from "../../src/color/deltaE.js";
import type { Lab } from "../../src/color/types.js";
import type { OpiSku } from "../../src/pipeline/opiTypes.js";

export type RankedOpi = {
  opi: OpiSku;
  deltaE: number;
  tier: MatchTier;
};

export function rankOpiMatches(paintLab: Lab, skus: OpiSku[], topN: number): RankedOpi[] {
  return skus
    .map((opi) => ({
      opi,
      deltaE: deltaE76(paintLab, opi.lab)
    }))
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, topN)
    .map((r) => ({
      ...r,
      tier: tierFromDeltaE(r.deltaE)
    }));
}
