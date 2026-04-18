/**
 * Batch-fetch PaintRef (paintref.com) color data for every manufacturer in
 * `PAINTREF_OEMS` and write one OEM scope per manufacturer. This is the
 * fastest way to get broad make/model coverage with spec-grade LAB where
 * PaintRef provides it.
 *
 * Pipeline (per OEM):
 *   1. Fetch advanced-search HTML with the configured year/model filters.
 *      Rows are parsed into PaintRefEntry objects (including chipUrl).
 *   2. (Optional, --sample-chips, default on) Download each unique chip
 *      image once via `chipSampler.ts`, average its pixels, and persist
 *      the result under `data/sources/paintref/chips/<slug>.json`.
 *   3. Build ColorSeeds via `paintRefEntryToSeed`, handing it the chip
 *      sample map so entries without inline LAB/hex fall through to
 *      `source="paintref_chip"` instead of being dropped.
 *   4. Write a scope under `data/oem/<slug>-paintref-v1/`. Models are
 *      sanitized via `looksLikeName` + optional vPIC cross-check so
 *      color names (e.g. "Alpinweiss") can never leak into the model list.
 *
 * Usage:
 *   tsx scripts/fetch-paintref-all.ts                           # all known OEMs
 *   tsx scripts/fetch-paintref-all.ts --oems "BMW,Audi"         # subset
 *   tsx scripts/fetch-paintref-all.ts --force-refresh           # ignore row cache
 *   tsx scripts/fetch-paintref-all.ts --mode advanced           # force advanced-search HTML mode
 *   tsx scripts/fetch-paintref-all.ts --scan-years              # paginate year-by-year per OEM
 *   tsx scripts/fetch-paintref-all.ts --scan-models             # also issue one model=X query per vPIC model
 *   tsx scripts/fetch-paintref-all.ts --sample-chips false      # skip chip sampling (dev only)
 *   tsx scripts/fetch-paintref-all.ts --chip-concurrency 4      # parallel chip downloads (default 4)
 *   tsx scripts/fetch-paintref-all.ts --dry-run                 # no writes
 *   tsx scripts/fetch-paintref-all.ts --concurrency 2           # OEM-level parallelism (default 2)
 *   tsx scripts/fetch-paintref-all.ts --delay-ms 750            # politeness delay between requests
 *
 * Cache layout:
 *   data/sources/paintref/raw/<slug>[--<hash>].json  — parsed rows (from paintref.ts)
 *   data/sources/paintref/chipimages/<hash>.png      — raw chip bytes (from chipSampler.ts)
 *   data/sources/paintref/chips/<slug>.json          — sampler output, keyed by chipHash
 *   data/oem/<slug>-paintref-v1/                     — final scope (this script writes)
 *
 * These scopes coexist with curated scopes (e.g. `bmw-x-v1`). Use
 * `merge-oem-scopes.ts` to pick the best-confidence LAB per paint code.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";
import {
  type AdvancedSearchFilters,
  type ChipSampleLookup,
  type PaintRefEntry,
  PAINTREF_OEMS,
  fetchPaintRefEntries,
  looksLikeName,
  mergePaintRefEntries,
  paintRefEntryToSeed,
  paintRefScopeIdFor,
  unionModelsFromEntries
} from "./lib/paintref.js";
import {
  ChipSampleError,
  type ChipSampleStore,
  loadChipSampleStore,
  recordFromSample,
  sampleChip,
  saveChipSampleStore
} from "./lib/chipSampler.js";
import { fetchFromStaticShtml } from "./lib/paintrefStaticShtml.js";

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
const SCAN_MODELS = args["scan-models"] === "true";
// Default on: chip sampling is the bulk-data source now.
const SAMPLE_CHIPS = args["sample-chips"] !== "false";
const CHIP_CONCURRENCY = Math.max(1, parseInt(args["chip-concurrency"] ?? "4", 10));

// `--shtml-enrich` runs the static-shtml crawler even when the live CGI
// succeeds. Off by default to keep polite request budgets small when the
// backend is healthy; the pipeline automatically falls back to static-shtml
// whenever the live fetch throws regardless of this flag.
const SHTML_ENRICH = args["shtml-enrich"] === "true";
const SHTML_DELAY_MS = Math.max(0, parseInt(args["shtml-delay-ms"] ?? "200", 10));
// Only used for log messaging — mirrors the COLORS list inside paintrefStaticShtml.ts.
const STATIC_COLORS = 11;

const OEMS: string[] = args["oems"]
  ? args["oems"].split(",").map((s) => s.trim()).filter(Boolean)
  : [...PAINTREF_OEMS];

const RECORDED_AT = new Date().toISOString().slice(0, 10);

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function oemSlug(oem: string): string {
  return oem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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
  rawRows: number;
  chipsSampled: number;
  chipsFailed: number;
  error?: string;
};

/**
 * Read the vPIC scope's model list for `oem` so `--scan-models` can issue
 * one `model=X` advanced-search query per real model. Falls back to the
 * empty list (scan becomes a no-op) when no vPIC scope exists — we don't
 * want to invent model names.
 */
function loadVpicModels(oem: string): string[] {
  const slug = oemSlug(oem);
  // vPIC slug for Mercedes is "mercedes-benz" even though PaintRef uses "mercedes".
  const candidates = [`${slug}-vpic-v1`, `${slug}-benz-vpic-v1`];
  for (const candidate of candidates) {
    const scopePath = join(repoRoot(), "data/oem", candidate, "oem-scope.json");
    if (!existsSync(scopePath)) continue;
    try {
      const data = JSON.parse(readFileSync(scopePath, "utf8")) as { models?: string[] };
      if (Array.isArray(data.models)) return data.models.filter((m): m is string => !!m);
    } catch {
      // Malformed scope → skip silently; caller treats empty as "no scan".
    }
  }
  return [];
}

async function fetchAllEntries(oem: string): Promise<PaintRefEntry[]> {
  const batches: PaintRefEntry[][] = [];
  const yearFilters: AdvancedSearchFilters | undefined = SCAN_YEARS
    ? { yearFrom: YEAR_FROM, yearTo: YEAR_TO }
    : undefined;

  // The live CGI endpoint is unreliable (Apache 2.2.3 often 503s for hours
  // at a time). We always attempt it first, but catch failures and fall
  // through to the static-shtml fallback so a single bad OEM pass doesn't
  // terminate the run. Whichever source(s) succeed get merged.
  let liveErr: unknown;
  try {
    const base = await fetchPaintRefEntries(oem, {
      forceRefresh: FORCE_REFRESH,
      mode: MODE,
      filters: yearFilters
    });
    batches.push(base);
  } catch (err) {
    liveErr = err;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [paintref] ${oem} advanced-search failed, will try static-shtml: ${msg}`);
  }

  if (SCAN_MODELS) {
    const models = loadVpicModels(oem);
    if (models.length === 0) {
      console.log(`  [paintref] --scan-models: no vPIC models for ${oem}, skipping`);
    } else {
      console.log(
        `  [paintref] --scan-models: issuing ${models.length} per-model queries for ${oem}`
      );
      for (const model of models) {
        try {
          const extra = await fetchPaintRefEntries(oem, {
            forceRefresh: FORCE_REFRESH,
            mode: MODE,
            filters: { model }
          });
          batches.push(extra);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  [paintref] ${oem} model="${model}": ${msg}`);
        }
        if (DELAY_MS > 0) await sleep(DELAY_MS);
      }
    }
  }

  // Static-shtml fallback: pre-rendered `/model/<color>_<model>.shtml` pages
  // served by LiteSpeed bypass the flaky CGI backend. They give us
  // (year, name, code, hex, ditzler) per row, which maps cleanly to
  // `paintref_hex` seeds via the existing downstream pipeline. We run this
  // unconditionally when the live CGI fetch failed, and opportunistically
  // when `--shtml-enrich` is passed (off by default, to keep the polite
  // request budget small when live is healthy).
  const shouldStatic = liveErr || SHTML_ENRICH;
  if (shouldStatic) {
    const models = loadVpicModels(oem);
    if (models.length > 0) {
      console.log(`  [paintref] static-shtml: probing ${models.length} models × ${STATIC_COLORS} colors for ${oem}`);
      try {
        const stat = await fetchFromStaticShtml(oem, {
          models,
          delayMs: SHTML_DELAY_MS,
          forceRefresh: FORCE_REFRESH
        });
        if (stat.length > 0) batches.push(stat);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [paintref] ${oem} static-shtml failed: ${msg}`);
      }
    }
  }

  if (batches.length === 0) {
    // Re-throw live error so the caller records this OEM as failed.
    throw liveErr ?? new Error(`no data sources produced entries for ${oem}`);
  }

  return mergePaintRefEntries(batches);
}

/**
 * Concurrency-limited chip sampler. Downloads each unique `chipUrl` once
 * (subsequent re-runs hit the on-disk PNG cache), persists results to the
 * sampler store incrementally so a mid-run crash still saves progress.
 */
async function sampleChipsFor(
  oem: string,
  entries: PaintRefEntry[]
): Promise<{
  samples: Map<string, ChipSampleLookup>;
  sampled: number;
  failed: number;
}> {
  const storePath = join(
    repoRoot(),
    "data/sources/paintref/chips",
    `${oemSlug(oem)}.json`
  );
  const store: ChipSampleStore = loadChipSampleStore(storePath);

  const unique = new Map<string, string>(); // chipHash → url
  for (const e of entries) {
    if (e.chipHash && e.chipUrl && !unique.has(e.chipHash)) {
      unique.set(e.chipHash, e.chipUrl);
    }
  }

  // Build the lookup up front from what's already on disk; only fetch the gap.
  const samples = new Map<string, ChipSampleLookup>();
  for (const [hash, record] of Object.entries(store)) {
    samples.set(hash, { hex: record.hex, rgb: record.rgb, pixels: record.pixels });
  }

  const todo: Array<[string, string]> = [];
  for (const [hash, url] of unique) {
    if (!samples.has(hash)) todo.push([hash, url]);
  }

  let sampled = 0;
  let failed = 0;

  if (todo.length === 0) {
    if (unique.size) {
      console.log(
        `  [paintref] chip sampler: ${unique.size} unique chips, all cached (${samples.size}/${unique.size} available)`
      );
    }
    return { samples, sampled, failed };
  }

  console.log(
    `  [paintref] chip sampler: ${todo.length} new chips to sample (${unique.size} unique total)`
  );

  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const myIdx = cursor++;
      const [hash, url] = todo[myIdx];
      try {
        const sample = await sampleChip(url);
        store[hash] = recordFromSample(sample);
        samples.set(hash, {
          hex: sample.hex,
          rgb: sample.rgb,
          pixels: sample.pixels
        });
        sampled++;
      } catch (err) {
        failed++;
        if (err instanceof ChipSampleError) {
          console.warn(`  [paintref] chip ${hash} rejected (${err.reason}): ${err.message}`);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  [paintref] chip ${hash} failed: ${msg}`);
        }
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CHIP_CONCURRENCY, todo.length) },
    () => worker()
  );
  await Promise.all(workers);

  if (!DRY_RUN) saveChipSampleStore(storePath, store);

  return { samples, sampled, failed };
}

/**
 * Clean the model list before it lands in the scope: drop obvious paint
 * names (fails `looksLikeName`), dedupe case-insensitively, and — when a
 * vPIC model list is available — log (not block) any PaintRef-only models
 * so we can audit whether PaintRef knows trims vPIC doesn't.
 */
function sanitizeModels(oem: string, raw: string[]): string[] {
  const vpic = new Set(loadVpicModels(oem).map((m) => m.toLowerCase()));
  const kept: string[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];

  for (const m of raw) {
    const trimmed = m.trim();
    if (!looksLikeName(trimmed, oem)) continue;
    // Cheap paint-name shibboleths ("Metallic", "Pearl", …) only exclude the
    // whole token if it's a single-word suffix with no vehicle number.
    if (/^(metallic|pearl|matte|solid|mica|tri-?coat)$/i.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
    if (vpic.size && !vpic.has(key)) unknown.push(trimmed);
  }

  if (unknown.length) {
    console.log(
      `  [paintref] ${oem}: ${unknown.length} PaintRef models not in vPIC (kept anyway) — sample: ${unknown
        .slice(0, 5)
        .join(", ")}`
    );
  }

  return kept.sort((a, b) => a.localeCompare(b));
}

async function processOem(oem: string): Promise<Result> {
  const scopeId = paintRefScopeIdFor(oem);
  // Resume support: if a full scope has already been written in a prior run
  // we skip this OEM entirely. Prevents re-running live-CGI retries (which
  // currently all 503) against already-complete data on every restart.
  // --force-refresh bypasses this shortcut.
  if (!FORCE_REFRESH) {
    const existingScope = join(repoRoot(), "data/oem", scopeId, "exterior-paints-v1.json");
    if (existsSync(existingScope)) {
      try {
        const paints = (JSON.parse(readFileSync(existingScope, "utf8")) as { paints?: unknown[] })
          .paints ?? [];
        const derived = paints.length;
        return {
          oem,
          scopeId,
          seeds: derived,
          spec: 0,
          derived,
          skipped: 0,
          rawRows: derived,
          chipsSampled: 0,
          chipsFailed: 0
        };
      } catch {
        // Malformed scope → fall through and re-fetch.
      }
    }
  }

  try {
    const entries = await fetchAllEntries(oem);

    let chipStats = { sampled: 0, failed: 0 };
    let chipSamples: Map<string, ChipSampleLookup> = new Map();
    if (SAMPLE_CHIPS) {
      const result = await sampleChipsFor(oem, entries);
      chipSamples = result.samples;
      chipStats = { sampled: result.sampled, failed: result.failed };
    }

    const seeds: ColorSeed[] = [];
    let autoIdx = 1;
    let skipped = 0;
    for (const entry of entries) {
      const seed = paintRefEntryToSeed(entry, {
        oem,
        fallbackIdx: autoIdx,
        chipSamples
      });
      if (!entry.code) autoIdx++;
      if (seed) seeds.push(seed);
      else skipped++;
    }

    const spec = seeds.filter((s) => s.confidence === "spec").length;
    const derived = seeds.filter((s) => s.confidence === "derived").length;

    if (seeds.length === 0) {
      return {
        oem,
        scopeId,
        seeds: 0,
        spec: 0,
        derived: 0,
        skipped,
        rawRows: entries.length,
        chipsSampled: chipStats.sampled,
        chipsFailed: chipStats.failed,
        error: "no usable entries"
      };
    }

    if (!DRY_RUN) {
      const scopeDir = join(repoRoot(), "data/oem", scopeId);
      const discoveredModels = sanitizeModels(oem, unionModelsFromEntries(entries));
      const meta: ScopeMeta = {
        scopeId,
        oem,
        from: YEAR_FROM,
        to: YEAR_TO,
        models: discoveredModels,
        notes:
          `${oem} exterior paint codes sourced from PaintRef (paintref.com) by fetch-paintref-all. ` +
          `Entries with LAB use confidence="spec"; hex-only entries and chip-image samples use confidence="derived". ` +
          `Chip-sampled rows carry source="paintref_chip" with provenance back to the averaged PNG at data/sources/paintref/chipimages/. ` +
          `Verify spec-grade entries with spectro before production claims. ` +
          `${discoveredModels.length} distinct models observed in advanced-search rows (sanitized). ` +
          `Merge with curated scopes via merge-oem-scopes to pick best-confidence LAB per code.`
      };
      writeScope(scopeDir, meta, seeds, RECORDED_AT);
    }

    return {
      oem,
      scopeId,
      seeds: seeds.length,
      spec,
      derived,
      skipped,
      rawRows: entries.length,
      chipsSampled: chipStats.sampled,
      chipsFailed: chipStats.failed
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      oem,
      scopeId,
      seeds: 0,
      spec: 0,
      derived: 0,
      skipped: 0,
      rawRows: 0,
      chipsSampled: 0,
      chipsFailed: 0,
      error: msg
    };
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
                `  ✔ ${r.oem}: ${r.seeds} seeds (spec=${r.spec}, derived=${r.derived}, skipped=${r.skipped}) ` +
                  `raw=${r.rawRows} chips=+${r.chipsSampled}/-${r.chipsFailed}`
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
              rawRows: 0,
              chipsSampled: 0,
              chipsFailed: 0,
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
      `(concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms, forceRefresh=${FORCE_REFRESH}, ` +
      `dryRun=${DRY_RUN}, mode=${MODE}, scanYears=${SCAN_YEARS}, scanModels=${SCAN_MODELS}, ` +
      `sampleChips=${SAMPLE_CHIPS}, chipConcurrency=${CHIP_CONCURRENCY}).`
  );

  const results = await runBatch();

  const ok = results.filter((r) => !r.error);
  const bad = results.filter((r) => r.error);
  const totalSeeds = ok.reduce((a, r) => a + r.seeds, 0);
  const totalSpec = ok.reduce((a, r) => a + r.spec, 0);
  const totalDerived = ok.reduce((a, r) => a + r.derived, 0);
  const totalChips = ok.reduce((a, r) => a + r.chipsSampled, 0);

  console.log(
    `\nSummary: ${ok.length} ok, ${bad.length} failed. ` +
      `${totalSeeds} paints total (${totalSpec} spec, ${totalDerived} derived, ${totalChips} new chips sampled).`
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
