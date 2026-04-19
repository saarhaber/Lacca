/**
 * Compare ACL label hex samples to an existing exterior-paints file (e.g. PaintRef scope).
 * Reports ΔE76 and ΔE00 (D65 / 2°) for each matching paint code.
 *
 * Usage:
 *   tsx scripts/acl-pilot-validate.ts \
 *     --labels data/sources/autocolorlibrary/pilot-labels-bmw-2019.json \
 *     --compare data/oem/bmw-paintref-v1/exterior-paints-v1.json
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deltaE00, deltaE76 } from "../src/color/deltaE.js";
import { srgbToLabD65 } from "../src/color/rgbToLab.js";
import type { Lab } from "../src/color/types.js";
import type { AclLabelRecord } from "./import-autocolorlibrary-labels.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Bad hex: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function normalizeCompareCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .split("/")[0]!
    .split(/\s+/)[0]!
    .replace(/^#/, "");
}

type ComparePaint = {
  code: string;
  marketingName: string;
  lab: Lab;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const labelsPath = args["labels"];
  const comparePath = args["compare"];
  if (!labelsPath || !comparePath) {
    console.error(
      "Usage: tsx scripts/acl-pilot-validate.ts --labels <.json> --compare data/oem/.../exterior-paints-v1.json"
    );
    process.exit(1);
  }

  const absLabels = labelsPath.startsWith("/") ? labelsPath : join(repoRoot(), labelsPath);
  const absCompare = comparePath.startsWith("/") ? comparePath : join(repoRoot(), comparePath);
  if (!existsSync(absLabels) || !existsSync(absCompare)) {
    console.error("Missing labels or compare file");
    process.exit(1);
  }

  const labels = JSON.parse(readFileSync(absLabels, "utf8")) as AclLabelRecord[];
  const compareJson = JSON.parse(readFileSync(absCompare, "utf8")) as {
    paints: ComparePaint[];
  };

  const byCode = new Map<string, ComparePaint>();
  for (const p of compareJson.paints ?? []) {
    byCode.set(normalizeCompareCode(p.code), p);
  }

  console.log(
    "code\tlabel_hex\tref_name\tdE76\tdE00\tmatch"
  );
  const rows: number[] = [];
  for (const L of labels) {
    const code = normalizeCompareCode(L.code);
    const ref = byCode.get(code);
    const hex = L.hex.startsWith("#") ? L.hex : `#${L.hex}`;
    if (!ref) {
      console.log(`${code}\t${hex}\t(no ref)\t-\t-\tMISS`);
      continue;
    }
    const [r, g, b] = hexToRgb(hex);
    const labFromHex: Lab = (() => {
      const x = srgbToLabD65(r, g, b);
      return { L: x.L, a: x.a, b: x.b };
    })();
    const d76 = deltaE76(labFromHex, ref.lab);
    const d00 = deltaE00(labFromHex, ref.lab);
    rows.push(d00);
    const ok = d00 < 8 ? "OK" : "HIGH";
    console.log(
      `${code}\t${hex}\t${ref.marketingName.replace(/\t/g, " ")}\t${d76.toFixed(2)}\t${d00.toFixed(2)}\t${ok}`
    );
  }

  if (rows.length) {
    const mean = rows.reduce((a, b) => a + b, 0) / rows.length;
    const max = Math.max(...rows);
    console.log(`\nΔE00 mean=${mean.toFixed(2)} max=${max.toFixed(2)} (metallic/pearl and JPEG artifacts inflate error)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
