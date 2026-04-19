/**
 * Merge label JSON files from acl-tesseract-batch into one file per vPIC-aligned
 * OEM name (e.g. Ford Truck → Ford, Range Rover → Land Rover), dedupe by year:code.
 *
 *   npx tsx scripts/acl-merge-batch-labels.ts
 *
 * Reads:  data/sources/autocolorlibrary/labels/tesseract-batch/*.json
 * Writes: data/sources/autocolorlibrary/labels/tesseract-merged/*.json
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AclLabelRecord } from "./import-autocolorlibrary-labels.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function scopeSlug(oem: string): string {
  return oem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Map ACL page headings to NHTSA / vPIC `oem-scope.json` labels */
function canonicalOem(raw: string): string {
  const k = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    "ford truck": "Ford",
    "ford import": "Ford",
    "chrysler import": "Chrysler",
    "dodge truck": "Dodge",
    "range rover": "Land Rover",
    "mercedes benz": "Mercedes-Benz",
    "kia motors": "Kia",
    "landrover": "Land Rover",
    "smart car": "Smart"
  };
  return map[k] ?? raw.trim();
}

function main() {
  const inDir = join(repoRoot(), "data/sources/autocolorlibrary/labels/tesseract-batch");
  const outDir = join(repoRoot(), "data/sources/autocolorlibrary/labels/tesseract-merged");
  if (!existsSync(inDir)) {
    console.error("Missing", inDir);
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const byOem = new Map<string, AclLabelRecord[]>();
  for (const fn of readdirSync(inDir)) {
    if (!fn.endsWith(".json")) continue;
    const path = join(inDir, fn);
    const recs = JSON.parse(readFileSync(path, "utf8")) as AclLabelRecord[];
    if (!Array.isArray(recs)) continue;
    for (const r of recs) {
      const oem = canonicalOem(r.oem);
      const list = byOem.get(oem) ?? [];
      list.push({ ...r, oem });
      byOem.set(oem, list);
    }
  }

  for (const [oem, recs] of byOem) {
    const dedup = new Map<string, AclLabelRecord>();
    for (const r of recs) {
      const code = r.code.split("/")[0]!.trim().toUpperCase().replace(/^#/, "");
      dedup.set(`${r.modelYear}:${code}`, r);
    }
    const finalList = [...dedup.values()].sort(
      (a, b) => a.modelYear - b.modelYear || a.code.localeCompare(b.code)
    );
    const outPath = join(outDir, `${scopeSlug(oem)}.json`);
    writeFileSync(outPath, JSON.stringify(finalList, null, 2) + "\n");
    console.log(`${oem}: ${finalList.length} rows → ${outPath}`);
  }
}

main();
