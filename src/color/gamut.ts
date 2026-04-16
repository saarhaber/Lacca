import type { Lab } from "./types.js";

/**
 * Inverse transform of the sRGB (D65) → LAB pipeline in `rgbToLab.ts`.
 * Returns the pre-clip linear sRGB triplet so callers can tell whether the
 * LAB point falls outside the 0–1 sRGB cube before we clamp for display.
 *
 * This is intentionally the mathematical inverse of `srgbToLabD65`, using
 * the same D65 white point and the same XYZ→linear-sRGB matrix so round
 * trips line up to floating-point precision.
 */
export function labToLinearSrgbD65(lab: Lab): {
  r: number;
  g: number;
  b: number;
} {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const xr = fxyzInverse(fx);
  const yr = fxyzInverse(fy);
  const zr = fxyzInverse(fz);

  const x = (xr * 95.047) / 100;
  const y = (yr * 100) / 100;
  const z = (zr * 108.883) / 100;

  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  return { r, g, b };
}

function fxyzInverse(f: number): number {
  const f3 = f * f * f;
  if (f3 > 0.008856) return f3;
  return (f - 16 / 116) / 7.787;
}

/**
 * Epsilon for gamut detection. Pure rounding at the LAB→RGB boundary can push
 * a color a hair outside [0,1]; we only flag colors that are meaningfully
 * outside so the UI doesn't cry wolf on every near-edge match.
 */
const GAMUT_EPSILON = 0.003;

export type GamutReport = {
  outOfGamut: boolean;
  /** True when any linear sRGB channel is below 0 (insufficient chroma reachable). */
  belowBlack: boolean;
  /** True when any linear sRGB channel exceeds 1 (would clip highlights). */
  aboveWhite: boolean;
};

export function labGamutReport(lab: Lab): GamutReport {
  const { r, g, b } = labToLinearSrgbD65(lab);
  const belowBlack =
    r < -GAMUT_EPSILON || g < -GAMUT_EPSILON || b < -GAMUT_EPSILON;
  const aboveWhite =
    r > 1 + GAMUT_EPSILON || g > 1 + GAMUT_EPSILON || b > 1 + GAMUT_EPSILON;
  return { outOfGamut: belowBlack || aboveWhite, belowBlack, aboveWhite };
}

export function isLabOutOfSrgbGamut(lab: Lab): boolean {
  return labGamutReport(lab).outOfGamut;
}
