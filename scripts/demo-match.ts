import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { deltaEFnForVersion, tierFromDeltaE } from "../src/color/deltaE.js";
import { loadOpiCatalogFromPointer } from "../src/pipeline/loadOpiCatalog.js";
import type { Lab } from "../src/color/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

type ExteriorPaint = { code: string; marketingName: string; finish: string; lab: Lab };
type ExteriorFile = { paints: ExteriorPaint[] };

function loadExterior(relPath: string): ExteriorFile {
  return JSON.parse(readFileSync(join(repoRoot, relPath), "utf8")) as ExteriorFile;
}

const opi = loadOpiCatalogFromPointer();
const deltaE = deltaEFnForVersion(opi.deltaEVersion);

function findPaint(file: ExteriorFile, code: string): ExteriorPaint {
  const match = file.paints.find((p) => p.code === code);
  if (!match) throw new Error(`Paint code ${code} not found`);
  return match;
}

function runCase(label: string, paint: ExteriorPaint): void {
  const ranked = opi.skus
    .map((sku) => ({ sku, de: deltaE(paint.lab, sku.lab) }))
    .sort((a, b) => a.de - b.de);
  const best = ranked[0];
  const tier = tierFromDeltaE(best.de, opi.deltaEVersion);

  console.log("");
  console.log(`== ${label} ==`);
  console.log(
    `Input: ${paint.code} "${paint.marketingName}" (${paint.finish})`
  );
  console.log(
    `Best OPI: ${best.sku.sku} "${best.sku.name}" — ΔE ${best.de.toFixed(2)} (${tier})`
  );
  const runnerUp = ranked[1];
  if (runnerUp) {
    console.log(
      `Runner-up: ${runnerUp.sku.sku} "${runnerUp.sku.name}" — ΔE ${runnerUp.de.toFixed(2)}`
    );
  }
}

const tesla = loadExterior("data/oem/tesla-model-3y-v1/exterior-paints-v1.json");
const bmw = loadExterior("data/oem/bmw-x-v1/exterior-paints-v1.json");

runCase("Tesla first paint (regression)", tesla.paints[0]);
runCase("BMW C06 — Brooklyn Grey Metallic", findPaint(bmw, "C06"));

console.log("");
console.log(
  `Catalog ${opi.catalogVersion}, ${opi.deltaEVersion}, ${opi.illuminant} / ${opi.observer}`
);
