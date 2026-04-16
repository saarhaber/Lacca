/**
 * Merge multiple source OEM scope folders into a single canonical scope,
 * picking the best-confidence LAB per paint code.
 *
 * Problem it solves:
 *   We may have three scopes that all contain BMW paints —
 *   `bmw-x-v1` (curated, hex-derived), `bmw-paintref-v1` (PaintRef, mixed
 *   spec + derived), and future sources (Pantone, OEM spec sheets, spectro
 *   re-reads). Each has partial coverage and varying confidence per code.
 *   This merger produces one canonical `bmw-v1/` scope that:
 *     1. Contains the UNION of all paint codes across sources.
 *     2. For each code, keeps the entry with the HIGHEST confidence
 *        (measured > spec > derived > estimated). Ties broken by source
 *        priority (defined in SOURCE_PRIORITY).
 *     3. Preserves provenance — the winning entry's `source`, `provenanceId`,
 *        and `notes` are kept, and a `merge_history` comment is added.
 *
 * Usage:
 *   tsx scripts/merge-oem-scopes.ts \
 *     --output bmw-v1 \
 *     --oem BMW \
 *     --models "3 Series,5 Series,X3,X5,X7" \
 *     --inputs "bmw-x-v1,bmw-paintref-v1" \
 *     [--year-from 2015] [--year-to 2024] \
 *     [--dry-run]
 *
 * Conventions:
 *   - `--inputs` lists scope directory names under `data/oem/`.
 *   - `--output` is the new scope directory name (also used as scopeId).
 *   - Matching uses a normalized code (uppercase, non-alphanumeric stripped)
 *     so "0Q0Q" and "0q0q" and "0Q-0Q" collapse to the same code.
 *   - Marketing name is picked from the winning entry unless another source
 *     has a non-empty name and the winner doesn't.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LabMeasurement } from "../src/color/types.js";
import {
  type ColorSeed,
  type Finish,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";

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
const OUTPUT = args["output"];
const OEM = args["oem"];
const INPUTS_ARG = args["inputs"];
const MODELS_ARG = args["models"];
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);
const DRY_RUN = args["dry-run"] === "true";

if (!OUTPUT || !OEM || !INPUTS_ARG) {
  console.error(
    "Usage: tsx scripts/merge-oem-scopes.ts --output <scope-id> --oem <OEM> " +
      "--inputs 'scope-a,scope-b' [--models 'A,B'] [--year-from] [--year-to] [--dry-run]"
  );
  process.exit(1);
}

const INPUTS = INPUTS_ARG.split(",").map((s) => s.trim()).filter(Boolean);
const RECORDED_AT = new Date().toISOString().slice(0, 10);

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

/** Ordered from weakest to strongest. Higher index wins. */
const CONFIDENCE_RANK: Record<LabMeasurement["confidence"], number> = {
  estimated: 0,
  derived: 1,
  spec: 2,
  measured: 3
};

/**
 * Tie-breaker when confidence is equal. Higher rank wins. Unknown sources
 * default to 0. Intentionally favors first-party spectral over third-party DBs
 * over hex fallbacks.
 */
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

type ExteriorPaintFile = {
  scopeId: string;
  version: string;
  paints: Array<{
    code: string;
    marketingName: string;
    finish: Finish;
    lab: LabMeasurement;
  }>;
};

function readExterior(scopeDir: string): ExteriorPaintFile | null {
  const path = join(scopeDir, "exterior-paints-v1.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ExteriorPaintFile;
}

function normCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type Candidate = {
  source: string;
  paint: ExteriorPaintFile["paints"][number];
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

function toSeed(winner: Candidate, others: Candidate[]): ColorSeed {
  const lab = winner.paint.lab;
  const mergeHistory = others
    .map((c) => `${c.source}:${c.paint.lab.confidence}(${c.paint.lab.source})`)
    .join(", ");
  const note =
    (lab.notes ?? "") +
    (mergeHistory
      ? ` [merge: chose ${winner.source}:${lab.confidence} over ${mergeHistory}]`
      : "");

  const best = others.length
    ? { L: lab.L, a: lab.a, b: lab.b }
    : { L: lab.L, a: lab.a, b: lab.b };

  return {
    code: winner.paint.code,
    marketingName: winner.paint.marketingName,
    finish: winner.paint.finish,
    lab: best,
    source: lab.source,
    confidence: lab.confidence,
    provenanceId: lab.provenanceId,
    note: note.trim()
  };
}

function merge(): ColorSeed[] {
  const buckets = new Map<string, Candidate[]>();

  for (const input of INPUTS) {
    const scopeDir = join(repoRoot(), "data/oem", input);
    const file = readExterior(scopeDir);
    if (!file) {
      console.warn(`  [skip input "${input}"] no exterior-paints-v1.json found at ${scopeDir}`);
      continue;
    }
    console.log(`  [input "${input}"] ${file.paints.length} paints`);
    for (const paint of file.paints) {
      const key = normCode(paint.code);
      const list = buckets.get(key) ?? [];
      list.push({ source: input, paint });
      buckets.set(key, list);
    }
  }

  const seeds: ColorSeed[] = [];
  const stats = { unique: 0, merged: 0, bySource: {} as Record<string, number> };

  for (const [, candidates] of buckets) {
    const winner = pickWinner(candidates);
    const others = candidates.filter((c) => c !== winner);
    if (others.length > 0) stats.merged++;
    else stats.unique++;
    const seed = toSeed(winner, others);
    seeds.push(seed);
    const key = `${winner.source}:${winner.paint.lab.confidence}`;
    stats.bySource[key] = (stats.bySource[key] ?? 0) + 1;
  }

  console.log(
    `\nMerge stats: ${stats.unique} unique, ${stats.merged} resolved across sources`
  );
  console.log("Winners by source:confidence:", stats.bySource);

  seeds.sort((a, b) => a.code.localeCompare(b.code));
  return seeds;
}

function main() {
  console.log(
    `\nMerging ${INPUTS.length} input scope(s) into "${OUTPUT}":\n  ${INPUTS.join(", ")}\n`
  );
  const seeds = merge();
  if (seeds.length === 0) {
    console.error("\nNo seeds after merge. Aborting.");
    process.exit(1);
  }

  const models = MODELS_ARG
    ? MODELS_ARG.split(",").map((m) => m.trim()).filter(Boolean)
    : [];
  const scopeDir = join(repoRoot(), "data/oem", OUTPUT);
  const meta: ScopeMeta = {
    scopeId: OUTPUT,
    oem: OEM,
    from: YEAR_FROM,
    to: YEAR_TO,
    models,
    supersedes: INPUTS,
    notes:
      `${OEM} exterior paints merged from ${INPUTS.length} source scope(s) ` +
      `(${INPUTS.join(", ")}). Per-code winners chosen by confidence ` +
      `(measured > spec > derived > estimated) with source priority as tiebreaker. ` +
      `Input scopes are listed in "supersedes" and are hidden from downstream consumers.`
  };

  if (DRY_RUN) {
    console.log("\n[dry-run] Would write to:", scopeDir);
    console.log("[dry-run] Meta:", JSON.stringify(meta, null, 2));
    console.log("[dry-run] First 3 merged seeds:", JSON.stringify(seeds.slice(0, 3), null, 2));
    return;
  }

  writeScope(scopeDir, meta, seeds, RECORDED_AT);
}

main();
