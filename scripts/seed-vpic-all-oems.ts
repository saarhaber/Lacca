/**
 * Populate every OEM in `PAINTREF_OEMS` (+ a curated extension list) with a
 * real model catalog sourced from the free NHTSA vPIC API.
 *
 * For each OEM we write `data/oem/<slug>-vpic-v1/`:
 *   - `oem-scope.json` with `models: [...]` derived from `GetModelsForMake`.
 *   - `exterior-paints-v1.json` with `paints: []` (schema-valid but empty).
 *
 * The web UI treats any scope with non-empty models as "supported", so the
 * make/model dropdowns light up immediately for every OEM we process.
 * Paint data is deliberately left empty here — the existing curated scopes
 * (BMW X, Porsche, Tesla 3/Y, Toyota) and future spectro/CSV imports
 * provide the actual ΔE-ready paint rows and will be preferred by the
 * merger (confidence > priority).
 *
 * Usage:
 *   tsx scripts/seed-vpic-all-oems.ts                       # all OEMs
 *   tsx scripts/seed-vpic-all-oems.ts --oems "Rivian,Lucid" # subset
 *   tsx scripts/seed-vpic-all-oems.ts --dry-run             # plan only
 *   tsx scripts/seed-vpic-all-oems.ts --force-refresh       # ignore cache
 *
 * Cached for 30 days under `data/sources/vpic/models-<slug>.json`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";
import { PAINTREF_OEMS } from "./lib/paintref.js";

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

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = args["dry-run"] === "true";
const FORCE_REFRESH = args["force-refresh"] === "true";
const DELAY_MS = Math.max(0, parseInt(args["delay-ms"] ?? "250", 10));
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const RECORDED_AT = new Date().toISOString().slice(0, 10);
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);

/**
 * OEMs not in PAINTREF_OEMS that we also want to cover. vPIC recognises
 * every major manufacturer; this is the modern EV-era + a few regional
 * brands that the PaintRef list pre-dates.
 */
const EXTRA_OEMS = [
  "Rivian",
  "Lucid",
  "Polestar",
  "Lotus",
  "Lancia",
  "Bugatti",
  "Koenigsegg",
  "Daihatsu",
  "Isuzu",
  "Hummer",
  "Karma",
  "Fisker",
  "VinFast",
  "BYD",
  "NIO",
  "Xpeng",
  "Li Auto",
  "Geely",
  "Chery",
  "SEAT",
  "Skoda",
  "Cupra",
  "Dacia",
  "Renault",
  "Peugeot",
  "Citroen",
  "DS",
  "Opel",
  "Vauxhall",
  "Proton",
  "Mahindra",
  "Tata",
  "Maybach",
  "Datsun"
] as const;

const ALL_OEMS: string[] = [...new Set([...PAINTREF_OEMS, ...EXTRA_OEMS])];

const OEMS = args["oems"]
  ? args["oems"].split(",").map((s) => s.trim()).filter(Boolean)
  : ALL_OEMS;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface VpicRow {
  Make_Name?: string;
  MakeName?: string;
  Model_Name?: string;
  ModelName?: string;
}

function cachePath(oem: string): string {
  return join(repoRoot(), "data/sources/vpic", `models-${slugify(oem)}.json`);
}

type CacheFile = {
  oem: string;
  fetchedAt: string;
  models: string[];
};

function readCache(path: string): string[] | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as CacheFile;
    const fetchedAt = new Date(raw.fetchedAt).getTime();
    if (!fetchedAt || Date.now() - fetchedAt > CACHE_MS) return null;
    return raw.models;
  } catch {
    return null;
  }
}

function writeCache(path: string, oem: string, models: string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: CacheFile = {
    oem,
    fetchedAt: new Date().toISOString(),
    models
  };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
}

async function fetchModels(oem: string): Promise<string[]> {
  const path = cachePath(oem);
  if (!FORCE_REFRESH) {
    const cached = readCache(path);
    if (cached) return cached;
  }

  const url =
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/` +
    `${encodeURIComponent(oem)}?format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`vPIC ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { Results?: VpicRow[] };
  const names = (json.Results ?? [])
    .map((r) => (r.Model_Name ?? r.ModelName ?? "").trim())
    .filter((n): n is string => n.length > 0);
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  writeCache(path, oem, unique);
  return unique;
}

type Result = {
  oem: string;
  scopeId: string;
  modelCount: number;
  error?: string;
};

async function processOem(oem: string): Promise<Result> {
  const scopeId = `${slugify(oem)}-vpic-v1`;
  try {
    const models = await fetchModels(oem);
    if (models.length === 0) {
      return { oem, scopeId, modelCount: 0, error: "vPIC returned no models" };
    }

    if (!DRY_RUN) {
      const scopeDir = join(repoRoot(), "data/oem", scopeId);
      const meta: ScopeMeta = {
        scopeId,
        oem,
        from: YEAR_FROM,
        to: YEAR_TO,
        models,
        notes:
          `${oem} model catalog sourced from NHTSA vPIC (GetModelsForMake). ` +
          `${models.length} distinct models. Paint catalog intentionally ` +
          `empty for this scope; the web UI falls back to generic colors ` +
          `when an OEM has no dedicated paint rows yet. Merge with curated ` +
          `scopes via merge-oem-scopes to enrich with real paint codes.`
      };
      writeScope(scopeDir, meta, [], RECORDED_AT);
    }

    return { oem, scopeId, modelCount: models.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { oem, scopeId, modelCount: 0, error: msg };
  }
}

async function main() {
  console.log(
    `\nseed-vpic-all-oems: ${OEMS.length} OEM${OEMS.length === 1 ? "" : "s"} ` +
      `(forceRefresh=${FORCE_REFRESH}, dryRun=${DRY_RUN})`
  );

  const results: Result[] = [];
  for (let i = 0; i < OEMS.length; i++) {
    const oem = OEMS[i];
    process.stdout.write(`[${i + 1}/${OEMS.length}] ${oem}… `);
    const r = await processOem(oem);
    results.push(r);
    if (r.error) {
      console.log(`skipped (${r.error})`);
    } else {
      console.log(`${r.modelCount} models → ${r.scopeId}`);
    }
    if (DELAY_MS > 0 && i < OEMS.length - 1) await sleep(DELAY_MS);
  }

  const ok = results.filter((r) => !r.error);
  const bad = results.filter((r) => r.error);
  const totalModels = ok.reduce((a, r) => a + r.modelCount, 0);
  console.log(
    `\nSummary: ${ok.length} ok, ${bad.length} skipped. ` +
      `${totalModels} total models across supported OEMs.`
  );
  if (bad.length) {
    console.log("\nSkipped:");
    for (const r of bad) console.log(`  - ${r.oem}: ${r.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
