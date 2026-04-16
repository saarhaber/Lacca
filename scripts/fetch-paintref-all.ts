/**
 * Batch-fetch PaintRef (paintref.com) color data for every manufacturer in
 * `PAINTREF_OEMS` and write one OEM scope per manufacturer. This is the
 * fastest way to get broad make/model coverage with spec-grade LAB where
 * PaintRef provides it.
 *
 * Usage:
 *   tsx scripts/fetch-paintref-all.ts                    # all known OEMs
 *   tsx scripts/fetch-paintref-all.ts --oems "BMW,Audi"  # subset
 *   tsx scripts/fetch-paintref-all.ts --force-refresh    # ignore disk cache
 *   tsx scripts/fetch-paintref-all.ts --mode advanced    # force advanced-search HTML mode
 *   tsx scripts/fetch-paintref-all.ts --scan-years       # paginate year-by-year per OEM
 *   tsx scripts/fetch-paintref-all.ts --dry-run          # no writes
 *   tsx scripts/fetch-paintref-all.ts --concurrency 2    # default 2
 *   tsx scripts/fetch-paintref-all.ts --delay-ms 750     # between requests
 *
 * Cache: individual fetches are cached under `data/sources/paintref/<slug>.json`
 * for 30 days by default, so re-running this script is cheap and idempotent.
 *
 * Output: `data/oem/<slug>-paintref-v1/{oem-scope,exterior-paints-v1}.json`.
 * These coexist with curated scopes (e.g. `bmw-x-v1`). Use `merge-oem-scopes.ts`
 * to merge them into a single canonical scope when you want the best-confidence
 * LAB per paint code.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";
import {
  type AdvancedSearchFilters,
  PAINTREF_OEMS,
  fetchPaintRefEntries,
  paintRefEntryToSeed,
  paintRefScopeIdFor,
  unionModelsFromEntries
} from "./lib/paintref.js";

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
const MODE = (args["mode"] ?? "auto") as "auto" | "json" | "advanced";
const CONCURRENCY = Math.max(1, parseInt(args["concurrency"] ?? "2", 10));
const DELAY_MS = Math.max(0, parseInt(args["delay-ms"] ?? "500", 10));
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);
const SCAN_YEARS = args["scan-years"] === "true";

const OEMS: string[] = args["oems"]
  ? args["oems"].split(",").map((s) => s.trim()).filter(Boolean)
  : [...PAINTREF_OEMS];

const RECORDED_AT = new Date().toISOString().slice(0, 10);

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type Result = {
  oem: string;
  scopeId: string;
  seeds: number;
  spec: number;
  derived: number;
  skipped: number;
  error?: string;
};

async function processOem(oem: string): Promise<Result> {
  const scopeId = paintRefScopeIdFor(oem);
  try {
    const filters: AdvancedSearchFilters | undefined = SCAN_YEARS
      ? { yearFrom: YEAR_FROM, yearTo: YEAR_TO }
      : undefined;
    const entries = await fetchPaintRefEntries(oem, {
      forceRefresh: FORCE_REFRESH,
      mode: MODE,
      filters
    });

    const seeds: ColorSeed[] = [];
    let autoIdx = 1;
    let skipped = 0;
    for (const entry of entries) {
      const seed = paintRefEntryToSeed(entry, { oem, fallbackIdx: autoIdx });
      if (!entry.code) autoIdx++;
      if (seed) seeds.push(seed);
      else skipped++;
    }

    const spec = seeds.filter((s) => s.confidence === "spec").length;
    const derived = seeds.filter((s) => s.confidence === "derived").length;

    if (seeds.length === 0) {
      return { oem, scopeId, seeds: 0, spec: 0, derived: 0, skipped, error: "no usable entries" };
    }

    if (!DRY_RUN) {
      const scopeDir = join(repoRoot(), "data/oem", scopeId);
      const discoveredModels = unionModelsFromEntries(entries);
      const meta: ScopeMeta = {
        scopeId,
        oem,
        from: YEAR_FROM,
        to: YEAR_TO,
        models: discoveredModels,
        notes:
          `${oem} exterior paint codes sourced from PaintRef (paintref.com) by fetch-paintref-all. ` +
          `Entries with LAB use confidence="spec"; RGB/hex-only entries use confidence="derived". ` +
          `Verify spec-grade entries with spectro before production claims. ` +
          `${discoveredModels.length} distinct models observed in advanced-search rows. ` +
          `Merge with curated scopes via merge-oem-scopes to pick best-confidence LAB per code.`
      };
      writeScope(scopeDir, meta, seeds, RECORDED_AT);
    }

    return { oem, scopeId, seeds: seeds.length, spec, derived, skipped };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { oem, scopeId, seeds: 0, spec: 0, derived: 0, skipped: 0, error: msg };
  }
}

async function runBatch(): Promise<Result[]> {
  const results: Result[] = [];
  const queue = [...OEMS];
  let active = 0;
  let idx = 0;

  return new Promise((resolve) => {
    const next = async () => {
      if (queue.length === 0 && active === 0) {
        resolve(results);
        return;
      }
      while (active < CONCURRENCY && queue.length > 0) {
        const oem = queue.shift()!;
        const i = ++idx;
        active++;
        console.log(`\n[${i}/${OEMS.length}] ${oem}`);
        processOem(oem)
          .then((r) => {
            results.push(r);
            if (r.error) {
              console.warn(`  ✖ ${r.oem}: ${r.error}`);
            } else {
              console.log(
                `  ✔ ${r.oem}: ${r.seeds} seeds (spec=${r.spec}, derived=${r.derived}, skipped=${r.skipped})`
              );
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({
              oem,
              scopeId: paintRefScopeIdFor(oem),
              seeds: 0,
              spec: 0,
              derived: 0,
              skipped: 0,
              error: msg
            });
            console.warn(`  ✖ ${oem}: ${msg}`);
          })
          .finally(async () => {
            active--;
            if (DELAY_MS > 0) await sleep(DELAY_MS);
            next();
          });
      }
    };
    next();
  });
}

async function main() {
  console.log(
    `\nBatch PaintRef fetch for ${OEMS.length} OEM${OEMS.length === 1 ? "" : "s"} ` +
      `(concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms, forceRefresh=${FORCE_REFRESH}, dryRun=${DRY_RUN}, mode=${MODE}, scanYears=${SCAN_YEARS}).`
  );

  const results = await runBatch();

  const ok = results.filter((r) => !r.error);
  const bad = results.filter((r) => r.error);
  const totalSeeds = ok.reduce((a, r) => a + r.seeds, 0);
  const totalSpec = ok.reduce((a, r) => a + r.spec, 0);
  const totalDerived = ok.reduce((a, r) => a + r.derived, 0);

  console.log(
    `\nSummary: ${ok.length} ok, ${bad.length} failed. ` +
      `${totalSeeds} paints total (${totalSpec} spec, ${totalDerived} derived).`
  );
  if (bad.length) {
    console.log("\nFailed OEMs:");
    for (const r of bad) console.log(`  - ${r.oem}: ${r.error}`);
  }
  if (DRY_RUN) console.log("\n[dry-run] No files written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
