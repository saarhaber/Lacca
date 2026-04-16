/**
 * Fetch automotive paint codes from PaintRef (paintref.com) and write them as
 * a valid OEM scope + exterior-paints JSON pair.
 *
 * Usage:
 *   tsx scripts/fetch-paintref-colors.ts \
 *     --oem BMW --scope-id bmw-paintref-v1 \
 *     [--year-from 2015] [--year-to 2024] \
 *     [--models "X3,X5"] \
 *     [--dry-run]
 *
 * PaintRef API:
 *   GET https://www.paintref.com/cgi-bin/colordata.cgi?manuf=BMW&format=json
 *   Public endpoint, no auth required.
 *
 * Confidence upgrade logic:
 *   - Entry has L, a, b fields        → confidence: "spec",    source: "paintref"
 *   - Entry has hex/rgb only          → confidence: "derived", source: "paintref_hex"
 *   - Entry has neither               → skipped with warning
 *
 * Known OEM name slugs accepted by PaintRef (partial list):
 *   BMW, Mercedes, Audi, Toyota, Honda, Ford, Chevrolet, Dodge, Jeep, Tesla,
 *   Volkswagen, Hyundai, Kia, Subaru, Mazda, Nissan, Volvo, Porsche, Ferrari,
 *   Lamborghini, Lexus, Acura, Infiniti, Cadillac, Buick, GMC, Ram, Chrysler
 *
 * After a successful run, register the new scope in src/pipeline/validateData.ts:
 *   { schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json",
 *     dataPath: "data/oem/<scope-id>/exterior-paints-v1.json" },
 *   { schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json",
 *     dataPath: "data/oem/<scope-id>/oem-scope.json" },
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type Finish,
  type ScopeMeta,
  round,
  writeScope
} from "../src/pipeline/seedHelpers.js";
import { srgbToLabD65 } from "../src/color/rgbToLab.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
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
const DRY_RUN = args["dry-run"] === "true";

if (!OEM || !SCOPE_ID) {
  console.error(
    "Usage: tsx scripts/fetch-paintref-colors.ts --oem <OEM> --scope-id <SCOPE_ID> [--year-from <YEAR>] [--year-to <YEAR>] [--models 'Model A,Model B'] [--dry-run]"
  );
  process.exit(1);
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// PaintRef API types
// ---------------------------------------------------------------------------
interface PaintRefEntry {
  /** Paint code, e.g. "475" */
  code?: string;
  /** Marketing/trade name */
  name?: string;
  colour?: string;
  color?: string;
  /** Finish descriptor */
  finish?: string;
  type?: string;
  /** Hex string with or without # */
  hex?: string;
  rgb?: string | [number, number, number];
  /** CIELAB fields — present on some entries */
  L?: number | string;
  a?: number | string;
  b?: number | string;
  /** Optional year range */
  year_from?: number | string;
  year_to?: number | string;
  /** Alternative provenanceId field */
  id?: number | string;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
async function fetchPaintRef(oem: string): Promise<PaintRefEntry[]> {
  const url =
    `https://www.paintref.com/cgi-bin/colordata.cgi?` +
    new URLSearchParams({ manuf: oem, format: "json" }).toString();

  console.log(`  GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "lacca-color-pipeline/1.0 (github.com/lacca)"
    }
  });

  if (!res.ok) {
    throw new Error(
      `PaintRef returned ${res.status} ${res.statusText}. ` +
        `Check that the OEM slug "${oem}" is recognized (e.g. BMW, Toyota, Ford).`
    );
  }

  const text = await res.text();

  // PaintRef may return JSON array or an object with a Results key
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `PaintRef response is not valid JSON. First 200 chars: ${text.slice(0, 200)}`
    );
  }

  if (Array.isArray(parsed)) return parsed as PaintRefEntry[];
  if (parsed && typeof parsed === "object" && "Results" in (parsed as object)) {
    return (parsed as { Results: PaintRefEntry[] }).Results;
  }
  if (parsed && typeof parsed === "object" && "data" in (parsed as object)) {
    return (parsed as { data: PaintRefEntry[] }).data;
  }

  throw new Error(
    `Unexpected PaintRef response shape. Keys: ${Object.keys(parsed as object).join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function inferFinish(raw?: string): Finish {
  if (!raw) return "solid";
  const lc = raw.toLowerCase();
  if (lc.includes("matte") || lc.includes("satin") || lc.includes("frozen")) return "matte";
  if (lc.includes("pearl") || lc.includes("tri") || lc.includes("tricoat")) return "pearl";
  if (lc.includes("metallic") || lc.includes("mica") || lc.includes("flake")) return "metallic";
  if (lc === "solid" || lc === "standard") return "solid";
  return "other";
}

function parseNum(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

function parseHex(raw: string): string | undefined {
  const h = raw.replace("#", "").trim().toUpperCase();
  if (h.length === 6 && /^[0-9A-F]{6}$/.test(h)) return `#${h}`;
  return undefined;
}

function parseRgb(raw: string | [number, number, number]): [number, number, number] | undefined {
  if (Array.isArray(raw)) {
    const [r, g, b] = raw;
    if ([r, g, b].every((v) => typeof v === "number" && v >= 0 && v <= 255)) return [r, g, b];
    return undefined;
  }
  const parts = String(raw)
    .split(",")
    .map((x) => parseInt(x.trim(), 10));
  if (parts.length >= 3 && parts.every((v) => !isNaN(v) && v >= 0 && v <= 255)) {
    return [parts[0], parts[1], parts[2]];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Entry → seed
// ---------------------------------------------------------------------------
let autoIdx = 1;

function entryToSeed(entry: PaintRefEntry, idx: number): ColorSeed | null {
  const nameRaw = (entry.name ?? entry.colour ?? entry.color ?? "").trim();
  const code = (entry.code ?? String(autoIdx++)).trim();
  const name = nameRaw || `Color ${code}`;
  const finishRaw = entry.finish ?? entry.type;
  const provenanceId = entry.id ? `paintref:${entry.id}` : `paintref:${OEM}:${code}`;

  // --- Try LAB first (highest quality from PaintRef) ---
  const L = parseNum(entry.L);
  const a = parseNum(entry.a);
  const b = parseNum(entry.b);

  if (L !== undefined && a !== undefined && b !== undefined) {
    return {
      code,
      marketingName: name,
      finish: inferFinish(finishRaw),
      lab: { L: round(L), a: round(a), b: round(b) },
      source: "paintref",
      confidence: "spec",
      provenanceId,
      note: `LAB from PaintRef (paintref.com), OEM=${OEM}, code=${code}. Treat as spec-grade; verify with spectro before production claims.`
    };
  }

  // --- Fall back to hex ---
  if (entry.hex) {
    const hex = parseHex(entry.hex);
    if (hex) {
      return {
        code,
        marketingName: name,
        finish: inferFinish(finishRaw),
        hex,
        source: "paintref_hex",
        confidence: "derived",
        provenanceId,
        note: `Derived from ${hex} (PaintRef hex, OEM=${OEM}, code=${code}). Replace with spectro LAB before production claims.`
      };
    }
  }

  // --- Fall back to rgb ---
  if (entry.rgb) {
    const rgb = parseRgb(entry.rgb);
    if (rgb) {
      const [r, g2, b2] = rgb;
      const hexStr = `#${r.toString(16).padStart(2, "0").toUpperCase()}${g2
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}${b2.toString(16).padStart(2, "0").toUpperCase()}`;
      return {
        code,
        marketingName: name,
        finish: inferFinish(finishRaw),
        hex: hexStr,
        source: "paintref_hex",
        confidence: "derived",
        provenanceId,
        note: `Derived from rgb(${r},${g2},${b2}) (PaintRef, OEM=${OEM}, code=${code}). Replace with spectro LAB before production claims.`
      };
    }
  }

  console.warn(
    `  [skip entry ${idx + 1}] "${name}" (code=${code}) — no LAB, hex, or RGB available`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
function countBy<T>(arr: T[], fn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  console.log(`\nFetching PaintRef colors for OEM "${OEM}"…\n`);

  const entries = await fetchPaintRef(OEM);
  console.log(`Received ${entries.length} entries from PaintRef.\n`);

  const seeds: ColorSeed[] = [];
  for (let i = 0; i < entries.length; i++) {
    const seed = entryToSeed(entries[i], i);
    if (seed) seeds.push(seed);
  }

  // Stats breakdown
  const byConfidence = countBy(seeds, (s) => s.confidence ?? "unknown");
  const bySource = countBy(seeds, (s) => s.source ?? "unknown");

  console.log(`\nConverted ${seeds.length} / ${entries.length} entries:`);
  console.log("  By confidence:", byConfidence);
  console.log("  By source:    ", bySource);

  if (seeds.length === 0) {
    console.error(
      "\nNo usable seeds. Check that the OEM slug is valid and PaintRef has data for it."
    );
    process.exit(1);
  }

  const models = MODELS_ARG
    ? MODELS_ARG.split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  const scopeDir = join(repoRoot(), "data/oem", SCOPE_ID);
  const meta: ScopeMeta = {
    scopeId: SCOPE_ID,
    oem: OEM,
    from: YEAR_FROM,
    to: YEAR_TO,
    models,
    notes: `${OEM} exterior paint codes sourced from PaintRef (paintref.com). ` +
      `Entries with LAB use confidence="spec"; RGB/hex-only entries use confidence="derived". ` +
      `Verify spec-grade entries with spectro before production claims.`
  };

  if (DRY_RUN) {
    console.log("\n[dry-run] Would write to:", scopeDir);
    console.log("[dry-run] Meta:", JSON.stringify(meta, null, 2));
    console.log("[dry-run] Sample seeds:", JSON.stringify(seeds.slice(0, 3), null, 2));
  } else {
    writeScope(scopeDir, meta, seeds, RECORDED_AT);
  }

  console.log(`
Done. To register in the validation pipeline, add to src/pipeline/validateData.ts:

  { schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json",
    dataPath: "data/oem/${SCOPE_ID}/exterior-paints-v1.json" },
  { schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json",
    dataPath: "data/oem/${SCOPE_ID}/oem-scope.json" },
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
