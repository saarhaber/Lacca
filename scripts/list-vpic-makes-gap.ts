/**
 * Fetch NHTSA vPIC GetAllMakes and diff against OEMs we already seed
 * (PAINTREF_OEMS + VPIC_SEED_EXTRA_OEMS). Use this to find vPIC makes we
 * never call GetModelsForMake for — candidates for VPIC_SEED_EXTRA_OEMS or
 * PaintRef alias work.
 *
 * Usage:
 *   tsx scripts/list-vpic-makes-gap.ts
 *   tsx scripts/list-vpic-makes-gap.ts --force-refresh
 *   tsx scripts/list-vpic-makes-gap.ts --json
 *   tsx scripts/list-vpic-makes-gap.ts --limit 80   # only print first N gap lines
 *   tsx scripts/list-vpic-makes-gap.ts --grep alpina # filter gaps (case-insensitive)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAINTREF_OEMS } from "./lib/paintref.js";
import { VPIC_SEED_EXTRA_OEMS } from "./lib/vpic-seed-oems.js";

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
const FORCE_REFRESH = args["force-refresh"] === "true";
const AS_JSON = args["json"] === "true";
const LIMIT = args["limit"] ? Math.max(0, parseInt(args["limit"], 10)) : 0;
const GREP = args["grep"]?.trim().toLowerCase() ?? "";

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function cachePath(): string {
  return join(repoRoot(), "data/sources/vpic", "all-makes.json");
}

interface VpicMakeRow {
  Make_ID?: number;
  Make_Id?: number;
  Make_Name?: string;
  MakeName?: string;
}

interface VpicMakesResponse {
  Count?: number;
  Results?: VpicMakeRow[];
}

type CachedMakes = {
  fetchedAt: string;
  makes: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Names we already pass to GetModelsForMake / PaintRef-style OEM strings. */
function knownNormalizedSet(): Set<string> {
  const all = [...PAINTREF_OEMS, ...VPIC_SEED_EXTRA_OEMS];
  return new Set(all.map((s) => norm(s)));
}

/**
 * True if this vPIC make string is already represented by our list
 * (exact CI match or prefix/suffix variant like Mercedes vs Mercedes-Benz).
 */
function isCovered(vpicMake: string, knownNorm: Set<string>): boolean {
  const n = norm(vpicMake);
  if (!n) return true;
  if (knownNorm.has(n)) return true;
  for (const k of knownNorm) {
    if (n === k) return true;
    if (n.startsWith(`${k} `) || n.startsWith(`${k}-`)) return true;
    if (k.startsWith(`${n} `) || k.startsWith(`${n}-`)) return true;
  }
  return false;
}

function readCache(path: string): string[] | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as CachedMakes;
    const t = new Date(raw.fetchedAt).getTime();
    if (!t || Date.now() - t > CACHE_MS) return null;
    if (!Array.isArray(raw.makes)) return null;
    return raw.makes;
  } catch {
    return null;
  }
}

function writeCache(path: string, makes: string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: CachedMakes = {
    fetchedAt: new Date().toISOString(),
    makes
  };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
}

async function fetchAllMakes(): Promise<string[]> {
  const path = cachePath();
  if (!FORCE_REFRESH) {
    const cached = readCache(path);
    if (cached) {
      console.error(`Using cached makes (${cached.length}) → ${path}`);
      return cached;
    }
  }

  const url = "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json";
  console.error(`GET ${url}`);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`vPIC ${res.status} ${res.statusText}`);
  const json = (await res.json()) as VpicMakesResponse;
  const names = (json.Results ?? [])
    .map((r) => (r.Make_Name ?? r.MakeName ?? "").trim())
    .filter((n): n is string => n.length > 0);
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  writeCache(path, unique);
  console.error(`Cached ${unique.length} makes → ${path}`);
  return unique;
}

async function main() {
  const knownNorm = knownNormalizedSet();
  const vpicMakes = await fetchAllMakes();
  const allGaps = vpicMakes.filter((m) => !isCovered(m, knownNorm));
  let gaps = allGaps;
  if (GREP) gaps = allGaps.filter((m) => m.toLowerCase().includes(GREP));

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          vpicMakeCount: vpicMakes.length,
          knownSeededCount: knownNorm.size,
          allGapCount: allGaps.length,
          gapCount: gaps.length,
          grep: GREP || undefined,
          gaps
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    `\nvPIC GetAllMakes: ${vpicMakes.length} distinct make strings ` +
      `(most “gaps” are small trailer/custom shops — use --grep to narrow)\n` +
      `Known seeded OEMs (PAINTREF + VPIC extras): ${knownNorm.size}\n` +
      `Not covered by prefix/exact match heuristics: ${allGaps.length}` +
      (GREP ? ` (showing ${gaps.length} matching --grep)\n` : `\n`)
  );

  const toPrint = LIMIT > 0 ? gaps.slice(0, LIMIT) : gaps;
  for (const m of toPrint) console.log(m);
  if (LIMIT > 0 && gaps.length > LIMIT) {
    console.log(`\n… ${gaps.length - LIMIT} more (run without --limit or use --json)`);
  }

  console.log(
    `\nAdd interesting names to scripts/lib/vpic-seed-oems.ts (VPIC_SEED_EXTRA_OEMS), ` +
      `then run: npm run seed:vpic -- --oems \"Name1,Name2\"\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
