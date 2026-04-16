import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { deltaE76, tierFromDeltaE } from "../src/color/deltaE.js";
import { loadOpiCatalogFromPointer } from "../src/pipeline/loadOpiCatalog.js";
import type { Lab } from "../src/color/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

type ExteriorFile = {
  paints: { code: string; marketingName: string; lab: Lab }[];
};

const exteriorPath = join(
  repoRoot,
  "data/oem/tesla-model-3y-v1/exterior-paints-v1.json"
);
const exterior = JSON.parse(readFileSync(exteriorPath, "utf8")) as ExteriorFile;
const paint = exterior.paints[0];
const opi = loadOpiCatalogFromPointer();

let best = { sku: "", name: "", de: Number.POSITIVE_INFINITY };

for (const sku of opi.skus) {
  const de = deltaE76(paint.lab, sku.lab);
  if (de < best.de) {
    best = { sku: sku.sku, name: sku.name, de };
  }
}

console.log(
  `Demo: exterior ${paint.code} (${paint.marketingName}) → best OPI ${best.sku} "${best.name}"`
);
console.log(`ΔE*_ab (CIE76) = ${best.de.toFixed(3)} (${tierFromDeltaE(best.de)})`);
console.log(`Catalog ${opi.catalogVersion}, ${opi.deltaEVersion}, ${opi.illuminant} / ${opi.observer}`);
