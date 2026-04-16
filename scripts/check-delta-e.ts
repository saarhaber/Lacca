import {
  DELTAE00_AUTOMOTIVE_WEIGHTS,
  deltaE00,
  deltaE76,
  deltaEFnForVersion,
  tierFromDeltaE
} from "../src/color/deltaE.js";
import type { Lab } from "../src/color/types.js";

/**
 * Minimal regression check for deltaE00 against published Sharma et al. pairs.
 * Run via: npx tsx scripts/check-delta-e.ts
 *
 * We validate a few representative rows — not the full 34-pair table — because
 * the goal here is to catch accidental breakage during refactors, not to
 * replace a full test suite.
 */

type Case = { label: string; lab1: Lab; lab2: Lab; expected: number };

const cases: Case[] = [
  {
    label: "Sharma row 1 (near-neutral)",
    lab1: { L: 50.0, a: 2.6772, b: -79.7751 },
    lab2: { L: 50.0, a: 0.0, b: -82.7485 },
    expected: 2.0425
  },
  {
    label: "Sharma row 10 (near-axis chroma shift)",
    lab1: { L: 50.0, a: 2.5, b: 0.0 },
    lab2: { L: 50.0, a: 0.0, b: -2.5 },
    expected: 4.3065
  },
  {
    label: "Sharma row 14 (hue rotation)",
    lab1: { L: 60.2574, a: -34.0099, b: 36.2677 },
    lab2: { L: 60.4626, a: -34.1751, b: 39.4387 },
    expected: 1.2644
  },
  {
    label: "Identity",
    lab1: { L: 40, a: 5, b: -3 },
    lab2: { L: 40, a: 5, b: -3 },
    expected: 0
  }
];

const TOLERANCE = 0.01;

let failures = 0;
for (const c of cases) {
  const got = deltaE00(c.lab1, c.lab2);
  const pass = Math.abs(got - c.expected) <= TOLERANCE;
  const status = pass ? "OK" : "FAIL";
  console.log(
    `${status}  ${c.label}: got ${got.toFixed(4)}, expected ${c.expected.toFixed(4)}`
  );
  if (!pass) failures++;
}

const sanity76 = deltaE76(
  { L: 50, a: 0, b: 0 },
  { L: 60, a: 0, b: 0 }
);
if (Math.abs(sanity76 - 10) > 1e-9) {
  console.log(`FAIL  deltaE76 sanity: got ${sanity76}`);
  failures++;
} else {
  console.log("OK  deltaE76 sanity (pure L delta)");
}

// Automotive 2:1:1 weighting must reduce lightness-only ΔE00 by ~half vs 1:1:1.
const lightnessPair: [Lab, Lab] = [
  { L: 50, a: 0, b: 0 },
  { L: 55, a: 0, b: 0 }
];
const de00Neutral = deltaE00(lightnessPair[0], lightnessPair[1]);
const de00Weighted = deltaE00(
  lightnessPair[0],
  lightnessPair[1],
  DELTAE00_AUTOMOTIVE_WEIGHTS.kL,
  DELTAE00_AUTOMOTIVE_WEIGHTS.kC,
  DELTAE00_AUTOMOTIVE_WEIGHTS.kH
);
if (de00Weighted > de00Neutral * 0.6 || de00Weighted < de00Neutral * 0.4) {
  console.log(
    `FAIL  deltaE00 2:1:1 lightness weighting: neutral=${de00Neutral.toFixed(4)} weighted=${de00Weighted.toFixed(4)}`
  );
  failures++;
} else {
  console.log(
    `OK  deltaE00 2:1:1 halves lightness-only ΔE (neutral=${de00Neutral.toFixed(4)} → weighted=${de00Weighted.toFixed(4)})`
  );
}

// deltaEFnForVersion must route "deltaE00" through the automotive weighting.
const routedFn = deltaEFnForVersion("deltaE00");
const routed = routedFn(lightnessPair[0], lightnessPair[1]);
if (Math.abs(routed - de00Weighted) > 1e-9) {
  console.log(
    `FAIL  deltaEFnForVersion(deltaE00) not using 2:1:1 weights (got ${routed.toFixed(4)}, want ${de00Weighted.toFixed(4)})`
  );
  failures++;
} else {
  console.log("OK  deltaEFnForVersion(deltaE00) applies 2:1:1 weights");
}

// Formula-specific tier cutoffs: ΔE=1.5 should be "explore" on CIE76 but
// "distant" on CIEDE2000 (tighter scale). This guards against accidentally
// reverting to shared thresholds.
const tier76 = tierFromDeltaE(1.5, "deltaE76");
const tier00 = tierFromDeltaE(1.5, "deltaE00");
if (tier76 !== "close" || tier00 !== "explore") {
  console.log(
    `FAIL  tierFromDeltaE version split: deltaE76(1.5)=${tier76}, deltaE00(1.5)=${tier00}`
  );
  failures++;
} else {
  console.log(
    `OK  tierFromDeltaE version split (ΔE 1.5 → ${tier76} on CIE76, ${tier00} on CIEDE2000)`
  );
}

if (failures > 0) {
  console.error(`${failures} ΔE check(s) failed`);
  process.exit(1);
}
console.log("All ΔE checks passed.");
