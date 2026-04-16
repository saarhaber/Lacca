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

export type MatchTier = "perfect" | "close" | "explore" | "distant";

/** Aligns with docs/GROUND_TRUTH.md match tiers. */
export function tierFromDeltaE(de: number): MatchTier {
  if (de < 1) return "perfect";
  if (de < 2) return "close";
  if (de < 4) return "explore";
  return "distant";
}
