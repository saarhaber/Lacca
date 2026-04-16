/**
 * One-shot color pipeline: for each OEM in the target list, run every
 * available source and produce a single canonical merged scope.
 *
 * What this does per OEM (e.g. "BMW"):
 *   1. Runs PaintRef (spec-grade LAB where available) →
 *      `data/oem/bmw-paintref-v1/`.
 *   2. Collects any pre-existing curated scopes for the same OEM
 *      (detected by matching `scope.oem` case-insensitively) and treats
 *      them as additional inputs.
 *   3. Merges all inputs into `data/oem/<slug>-v1/` using
 *      merge-oem-scopes.ts logic (confidence > source-priority).
 *   4. Writes the merged scope with `supersedes` set so the web UI hides
 *      the raw inputs and shows only the canonical merged entry.
 *
 * Usage:
 *   tsx scripts/fetch-all-colors.ts                        # full run, every OEM
 *   tsx scripts/fetch-all-colors.ts --oems "BMW,Toyota"    # subset
 *   tsx scripts/fetch-all-colors.ts --skip-paintref        # skip PaintRef step
 *   tsx scripts/fetch-all-colors.ts --paintref-mode advanced
 *   tsx scripts/fetch-all-colors.ts --scan-years           # paginate year-by-year per OEM
 *   tsx scripts/fetch-all-colors.ts --force-refresh        # ignore caches
 *   tsx scripts/fetch-all-colors.ts --dry-run              # plan only
 *
 * This is the command you want to run to bring a fresh clone to the broadest
 * coverage the pipeline can deliver today. Re-running is cheap: PaintRef
 * responses are cached on disk for 30 days under `data/sources/paintref/`.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LabMeasurement } from "../src/color/types.js";
import {
  type ColorSeed,
  type Finish,
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
const SKIP_PAINTREF = args["skip-paintref"] === "true";
const FORCE_REFRESH = args["force-refresh"] === "true";
const PAINTREF_MODE = (args["paintref-mode"] ?? "auto") as "auto" | "json" | "advanced";
const SCAN_YEARS = args["scan-years"] === "true";
const DELAY_MS = Math.max(0, parseInt(args["delay-ms"] ?? "500", 10));
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);
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

const CONFIDENCE_RANK: Record<LabMeasurement["confidence"], number> = {
  estimated: 0,
  derived: 1,
  spec: 2,
  measured: 3
};

const SOURCE_PRIORITY: Record<string, number> = {
  spectro_reread: 100,
  oem_spec: 90,
  pantone: 80,
  ral_classic: 75,
  paintref: 70,
  third_party_db: 60,
  nhtsa_vpic: 40,
  carapi: 35,
  paintref_hex: 30,
  hex_derived: 20,
  placeholder_prototype: 5
};

type ExteriorFile = {
  scopeId: string;
  paints: Array<{
    code: string;
    marketingName: string;
    finish: Finish;
    lab: LabMeasurement;
  }>;
};

type ScopeFile = {
  scopeId: string;
  oem: string;
  models?: string[];
  supersedes?: string[];
};

function normCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Find all existing scope directories for a given OEM name, case-insensitive. */
function findExistingScopesForOem(oemName: string): { scopeId: string; models: string[] }[] {
  const oemDir = join(repoRoot(), "data/oem");
  if (!existsSync(oemDir)) return [];
  const out: { scopeId: string; models: string[] }[] = [];
  const wanted = oemName.toLowerCase();
  for (const entry of readdirSync(oemDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const scopePath = join(oemDir, entry.name, "oem-scope.json");
    if (!existsSync(scopePath)) continue;
    try {
      const scope = JSON.parse(readFileSync(scopePath, "utf8")) as ScopeFile;
      if (scope.oem.toLowerCase() === wanted) {
        out.push({ scopeId: scope.scopeId, models: scope.models ?? [] });
      }
    } catch {
      // ignore malformed scope
    }
  }
  return out;
}

function readExterior(scopeId: string): ExteriorFile | null {
  const p = join(repoRoot(), "data/oem", scopeId, "exterior-paints-v1.json");
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as ExteriorFile;
}

type Candidate = {
  source: string;
  paint: ExteriorFile["paints"][number];
};

function pickWinner(candidates: Candidate[]): Candidate {
  return candidates
    .slice()
    .sort((a, b) => {
      const rA = CONFIDENCE_RANK[a.paint.lab.confidence] ?? 0;
      const rB = CONFIDENCE_RANK[b.paint.lab.confidence] ?? 0;
      if (rA !== rB) return rB - rA;
      const pA = SOURCE_PRIORITY[a.paint.lab.source] ?? 0;
      const pB = SOURCE_PRIORITY[b.paint.lab.source] ?? 0;
      if (pA !== pB) return pB - pA;
      return (b.paint.marketingName?.length ?? 0) - (a.paint.marketingName?.length ?? 0);
    })[0];
}

function winnerToSeed(winner: Candidate, others: Candidate[]): ColorSeed {
  const lab = winner.paint.lab;
  const history = others
    .map((c) => `${c.source}:${c.paint.lab.confidence}(${c.paint.lab.source})`)
    .join(", ");
  const note =
    (lab.notes ?? "") +
    (history ? ` [merge: chose ${winner.source}:${lab.confidence} over ${history}]` : "");
  return {
    code: winner.paint.code,
    marketingName: winner.paint.marketingName,
    finish: winner.paint.finish,
    lab: { L: lab.L, a: lab.a, b: lab.b },
    source: lab.source,
    confidence: lab.confidence,
    provenanceId: lab.provenanceId,
    note: note.trim()
  };
}

type OemResult = {
  oem: string;
  paintrefSeeds: number;
  paintrefSpec: number;
  inputs: string[];
  mergedCount: number;
  mergedScopeId: string;
  error?: string;
};

async function runPaintRef(oem: string): Promise<{ scopeId: string; count: number; spec: number } | null> {
  if (SKIP_PAINTREF) return null;
  try {
    const filters: AdvancedSearchFilters | undefined = SCAN_YEARS
      ? { yearFrom: YEAR_FROM, yearTo: YEAR_TO }
      : undefined;
    const entries = await fetchPaintRefEntries(oem, {
      forceRefresh: FORCE_REFRESH,
      mode: PAINTREF_MODE,
      filters
    });
    const seeds: ColorSeed[] = [];
    let autoIdx = 1;
    for (const entry of entries) {
      const seed = paintRefEntryToSeed(entry, { oem, fallbackIdx: autoIdx });
      if (!entry.code) autoIdx++;
      if (seed) seeds.push(seed);
    }
    if (seeds.length === 0) return null;

    const scopeId = paintRefScopeIdFor(oem);
    const spec = seeds.filter((s) => s.confidence === "spec").length;
    const discoveredModels = unionModelsFromEntries(entries);

    if (!DRY_RUN) {
      const scopeDir = join(repoRoot(), "data/oem", scopeId);
      const meta: ScopeMeta = {
        scopeId,
        oem,
        from: YEAR_FROM,
        to: YEAR_TO,
        models: discoveredModels,
        notes:
          `${oem} exterior paint codes from PaintRef (paintref.com). ` +
          `LAB entries → "spec"; hex/RGB → "derived". ` +
          `${discoveredModels.length} distinct models observed in advanced-search rows. ` +
          `Merged into a canonical scope by fetch-all-colors.`
      };
      writeScope(scopeDir, meta, seeds, RECORDED_AT);
    }

    return { scopeId, count: seeds.length, spec };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`    [paintref] ${oem}: ${msg}`);
    return null;
  }
}

function mergeForOem(oem: string, inputScopeIds: string[]): { seeds: ColorSeed[]; scopeId: string } {
  const buckets = new Map<string, Candidate[]>();
  for (const sid of inputScopeIds) {
    const file = readExterior(sid);
    if (!file) continue;
    for (const paint of file.paints) {
      const key = normCode(paint.code);
      const list = buckets.get(key) ?? [];
      list.push({ source: sid, paint });
      buckets.set(key, list);
    }
  }

  const seeds: ColorSeed[] = [];
  for (const [, candidates] of buckets) {
    const winner = pickWinner(candidates);
    const others = candidates.filter((c) => c !== winner);
    seeds.push(winnerToSeed(winner, others));
  }
  seeds.sort((a, b) => a.code.localeCompare(b.code));
  return { seeds, scopeId: `${slugify(oem)}-all-v1` };
}

/**
 * Collect models from every input scope so the merged canonical scope
 * exposes the union. De-dupes case-insensitively.
 */
function unionModels(inputScopeIds: string[]): string[] {
  const seen = new Map<string, string>();
  for (const sid of inputScopeIds) {
    const scopePath = join(repoRoot(), "data/oem", sid, "oem-scope.json");
    if (!existsSync(scopePath)) continue;
    try {
      const scope = JSON.parse(readFileSync(scopePath, "utf8")) as ScopeFile;
      for (const m of scope.models ?? []) {
        const k = m.toLowerCase();
        if (!seen.has(k)) seen.set(k, m);
      }
    } catch {
      // ignore
    }
  }
  return [...seen.values()].sort();
}

async function processOem(oem: string): Promise<OemResult> {
  console.log(`\n=== ${oem} ===`);
  const result: OemResult = {
    oem,
    paintrefSeeds: 0,
    paintrefSpec: 0,
    inputs: [],
    mergedCount: 0,
    mergedScopeId: `${slugify(oem)}-all-v1`
  };

  const paintref = await runPaintRef(oem);
  if (paintref) {
    console.log(
      `  [paintref] wrote ${paintref.scopeId} with ${paintref.count} seeds (${paintref.spec} spec)`
    );
    result.paintrefSeeds = paintref.count;
    result.paintrefSpec = paintref.spec;
    result.inputs.push(paintref.scopeId);
  }

  for (const s of findExistingScopesForOem(oem)) {
    if (s.scopeId === result.mergedScopeId) continue;
    if (result.inputs.includes(s.scopeId)) continue;
    result.inputs.push(s.scopeId);
  }

  if (result.inputs.length === 0) {
    result.error = "no inputs (paintref empty, no pre-existing scopes)";
    console.warn(`  ! ${oem}: ${result.error}`);
    return result;
  }

  if (result.inputs.length === 1) {
    result.error = `only one input (${result.inputs[0]}) — nothing to merge, leaving it canonical`;
    console.log(`  · ${oem}: ${result.error}`);
    return result;
  }

  const { seeds, scopeId } = mergeForOem(oem, result.inputs);
  result.mergedCount = seeds.length;
  result.mergedScopeId = scopeId;

  if (seeds.length === 0) {
    result.error = "merge produced zero seeds";
    return result;
  }

  if (!DRY_RUN) {
    const meta: ScopeMeta = {
      scopeId,
      oem,
      from: YEAR_FROM,
      to: YEAR_TO,
      models: unionModels(result.inputs),
      supersedes: result.inputs,
      notes:
        `${oem} canonical exterior paints merged from ${result.inputs.length} source scope(s) ` +
        `(${result.inputs.join(", ")}). Per-code winners chosen by confidence ` +
        `(measured > spec > derived > estimated) with source priority as tiebreaker. ` +
        `Generated by fetch-all-colors.`
    };
    writeScope(join(repoRoot(), "data/oem", scopeId), meta, seeds, RECORDED_AT);
    console.log(
      `  [merge] wrote ${scopeId}: ${seeds.length} paints (supersedes ${result.inputs.join(", ")})`
    );
  } else {
    console.log(`  [dry-run] would merge → ${scopeId} with ${seeds.length} paints`);
  }

  return result;
}

async function main() {
  console.log(
    `\nfetch-all-colors: ${OEMS.length} OEM${OEMS.length === 1 ? "" : "s"} ` +
      `(skipPaintref=${SKIP_PAINTREF}, forceRefresh=${FORCE_REFRESH}, dryRun=${DRY_RUN})`
  );

  const results: OemResult[] = [];
  for (const oem of OEMS) {
    results.push(await processOem(oem));
    if (DELAY_MS > 0 && !SKIP_PAINTREF) await sleep(DELAY_MS);
  }

  const ok = results.filter((r) => !r.error);
  const bad = results.filter((r) => r.error);
  const totalMerged = ok.reduce((a, r) => a + r.mergedCount, 0);
  const totalSpec = ok.reduce((a, r) => a + r.paintrefSpec, 0);
  console.log(
    `\nSummary: ${ok.length} ok, ${bad.length} skipped. ` +
      `${totalMerged} canonical paints across all OEMs (${totalSpec} spec-grade from PaintRef).`
  );
  if (bad.length) {
    console.log("\nSkipped OEMs:");
    for (const r of bad) console.log(`  - ${r.oem}: ${r.error}`);
  }
  if (DRY_RUN) console.log("\n[dry-run] No files written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
