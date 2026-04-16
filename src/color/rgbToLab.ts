import type { Lab } from "./types.js";

/**
 * sRGB [0–255] → CIELAB (D65, 2° implied by matrix) via linear sRGB → XYZ.
 * Use only for `confidence: "derived"` paths when direct LAB is unavailable.
 */
export function srgbToLabD65(r255: number, g255: number, b255: number): Lab {
  const r = srgbChannelToLinear(r255);
  const g = srgbChannelToLinear(g255);
  const b = srgbChannelToLinear(b255);

  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  let z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  x = (x * 100) / 95.047;
  y = (y * 100) / 100.0;
  z = (z * 100) / 108.883;

  const fx = fxyz(x);
  const fy = fxyz(y);
  const fz = fxyz(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);

  return { L, a, b: bStar };
}

function srgbChannelToLinear(c255: number): number {
  const v = c255 / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function fxyz(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
}
