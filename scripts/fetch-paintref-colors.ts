/**
 * Fetch automotive paint codes from PaintRef (paintref.com) for a single OEM
 * and write them as a valid OEM scope + exterior-paints JSON pair.
 *
 * Usage:
 *   tsx scripts/fetch-paintref-colors.ts \
 *     --oem BMW --scope-id bmw-paintref-v1 \
 *     [--year-from 2015] [--year-to 2024] \
 *     [--models "X3,X5"] \
 *     [--mode auto|json|advanced] \
 *     [--filter-model X3] \
 *     [--keywords "Brooklyn Grey"] \
 *     [--scan-years]          # one paginated query per year in [year-from, year-to]
 *     [--force-refresh] \
 *     [--dry-run]
 *
 * Examples:
 *   # Everything BMW, advanced-search with pagination (auto-discovers models):
 *   tsx scripts/fetch-paintref-colors.ts --oem BMW --scope-id bmw-paintref-v1 --mode advanced
 *
 *   # Targeted pull: only X3 Brooklyn Grey variants across recent years.
 *   tsx scripts/fetch-paintref-colors.ts \
 *     --oem BMW --scope-id bmw-x3-brooklyn-v1 --mode advanced \
 *     --filter-model X3 --keywords "Brooklyn Grey" --scan-years \
 *     --year-from 2018 --year-to 2026
 *
 * For batch coverage of every supported manufacturer in one go, see
 * `scripts/fetch-paintref-all.ts` (npm run `fetch:paintref:all`).
 *
 * PaintRef API:
 *   JSON (preferred when live): /cgi-bin/colordata.cgi?manuf=<OEM>&format=json
 *   HTML (advanced search):     /cgi-bin/colorcodedisplay.cgi?manuf=<OEM>&model=…&keywords=…&year=…&rows=200&page=N
 *
 * Confidence upgrade logic (handled in scripts/lib/paintref.ts):
 *   - Entry has L, a, b fields → confidence: "spec",    source: "paintref"
 *   - Entry has hex/rgb only   → confidence: "derived", source: "paintref_hex"
 *   - Entry has neither        → skipped with warning
 *
 * Validation auto-discovers every `data/oem/<scope-id>/` folder — no manual
 * registration in `src/pipeline/validateData.ts` is required.
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
  fetchPaintRefEntries,
  paintRefEntryToSeed,
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

const OEM = args["oem"];
const SCOPE_ID = args["scope-id"];
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);
const MODELS_ARG = args["models"];
const MODE = (args["mode"] ?? "auto") as "auto" | "json" | "advanced";
const FILTER_MODEL = args["filter-model"];
const KEYWORDS = args["keywords"];
const SINGLE_YEAR = args["year"] ? parseInt(args["year"], 10) : undefined;
const SCAN_YEARS = args["scan-years"] === "true";
const DRY_RUN = args["dry-run"] === "true";
const FORCE_REFRESH = args["force-refresh"] === "true";

if (!OEM || !SCOPE_ID) {
  console.error(
    "Usage: tsx scripts/fetch-paintref-colors.ts --oem <OEM> --scope-id <SCOPE_ID> " +
      "[--year-from <YEAR>] [--year-to <YEAR>] [--models 'Model A,Model B'] " +
      "[--mode auto|json|advanced] [--filter-model <Model>] [--keywords <text>] " +
      "[--year <YYYY>] [--scan-years] [--force-refresh] [--dry-run]"
  );
  process.exit(1);
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);

function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function buildFilters(): AdvancedSearchFilters | undefined {
  const filters: AdvancedSearchFilters = {};
  if (FILTER_MODEL) filters.model = FILTER_MODEL;
  if (KEYWORDS) filters.keywords = KEYWORDS;
  if (SINGLE_YEAR !== undefined) filters.year = SINGLE_YEAR;
  if (SCAN_YEARS) {
    filters.yearFrom = YEAR_FROM;
    filters.yearTo = YEAR_TO;
  }
  return Object.keys(filters).length ? filters : undefined;
}

async function main() {
  console.log(`\nFetching PaintRef colors for OEM "${OEM}"…\n`);

  const filters = buildFilters();
  const entries = await fetchPaintRefEntries(OEM, {
    forceRefresh: FORCE_REFRESH,
    mode: MODE,
    filters
  });
  console.log(`Received ${entries.length} entries from PaintRef.\n`);

  const seeds: ColorSeed[] = [];
  let autoIdx = 1;
  let skipped = 0;
  for (const entry of entries) {
    const seed = paintRefEntryToSeed(entry, { oem: OEM, fallbackIdx: autoIdx });
    if (!entry.code) autoIdx++;
    if (seed) {
      seeds.push(seed);
    } else {
      skipped++;
    }
  }

  const byConfidence = countBy(seeds, (s) => s.confidence ?? "unknown");
  const bySource = countBy(seeds, (s) => s.source ?? "unknown");

  console.log(`Converted ${seeds.length} / ${entries.length} entries (skipped ${skipped}):`);
  console.log("  By confidence:", byConfidence);
  console.log("  By source:    ", bySource);

  if (seeds.length === 0) {
    console.error(
      "\nNo usable seeds. Check that the OEM slug is valid and PaintRef has data for it."
    );
    process.exit(1);
  }

  const explicitModels = MODELS_ARG
    ? MODELS_ARG.split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];
  const discoveredModels = unionModelsFromEntries(entries);
  const models = explicitModels.length ? explicitModels : discoveredModels;

  const scopeDir = join(repoRoot(), "data/oem", SCOPE_ID);
  const filterSummary = filters
    ? ` Filters: ${JSON.stringify(filters)}.`
    : "";
  const meta: ScopeMeta = {
    scopeId: SCOPE_ID,
    oem: OEM,
    from: YEAR_FROM,
    to: YEAR_TO,
    models,
    notes:
      `${OEM} exterior paint codes sourced from PaintRef (paintref.com). ` +
      `Entries with LAB use confidence="spec"; RGB/hex-only entries use confidence="derived".` +
      filterSummary +
      ` ${discoveredModels.length} distinct models observed in the raw rows. ` +
      `Verify spec-grade entries with spectro before production claims.`
  };

  if (DRY_RUN) {
    console.log("\n[dry-run] Would write to:", scopeDir);
    console.log("[dry-run] Meta:", JSON.stringify(meta, null, 2));
    console.log("[dry-run] Sample seeds:", JSON.stringify(seeds.slice(0, 3), null, 2));
  } else {
    writeScope(scopeDir, meta, seeds, RECORDED_AT);
  }

  console.log(`\nDone. Validation auto-discovers data/oem/${SCOPE_ID}/ — no further wiring needed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
