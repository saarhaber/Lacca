/**
 * Import automotive paint colors from a Kaggle-style CSV file and write them
 * as valid OEM scope + exterior-paints JSON pairs.
 *
 * Usage:
 *   tsx scripts/import-kaggle-csv.ts \
 *     --file path/to/dataset.csv \
 *     --scope-id ford-kaggle-v1 \
 *     [--make Ford] \
 *     [--year-from 2015] [--year-to 2024] \
 *     [--dry-run]
 *
 * Flexible column detection (case-insensitive, first match wins):
 *
 *   Paint code  : "code", "paint_code", "paint code", "colour_code", "color_code"
 *   Color name  : "name", "color", "colour", "color_name", "colour_name", "marketing_name"
 *   Finish      : "finish", "type", "paint_type"
 *   Hex         : "hex", "hex_code", "hex_color", "colour_hex", "color_hex", "#hex"
 *   R / G / B   : "r", "red" / "g", "green" / "b", "blue"
 *   Make        : "make", "manufacturer", "brand", "oem"
 *   Model       : "model", "model_name", "vehicle"
 *   Year        : "year", "model_year", "year_from"
 *
 * Grouping:
 *   If the CSV has make+model columns each unique make+model combination becomes
 *   its own scope under data/oem/<scope-id>-<make>-<model>/.
 *   Otherwise all rows go into a single scope at data/oem/<scope-id>/.
 *
 * Output LAB confidence: "derived" (hex/RGB → sRGB → LAB).
 *
 * After a successful run, register each new scope in src/pipeline/validateData.ts:
 *   { schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json",
 *     dataPath: "data/oem/<scope-id>/exterior-paints-v1.json" },
 *   { schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json",
 *     dataPath: "data/oem/<scope-id>/oem-scope.json" },
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type Finish,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";

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

const CSV_FILE = args["file"];
const SCOPE_ID = args["scope-id"];
const MAKE_ARG = args["make"] ?? "";
const YEAR_FROM = parseInt(args["year-from"] ?? "2000", 10);
const YEAR_TO = parseInt(args["year-to"] ?? String(new Date().getFullYear()), 10);
const DRY_RUN = args["dry-run"] === "true";

if (!CSV_FILE || !SCOPE_ID) {
  console.error(
    "Usage: tsx scripts/import-kaggle-csv.ts --file <CSV_PATH> --scope-id <SCOPE_ID> [--make <MAKE>] [--year-from <YEAR>] [--year-to <YEAR>] [--dry-run]"
  );
  process.exit(1);
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);
const SOURCE_TAG = `kaggle_csv:${basename(CSV_FILE)}`;

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------
const COL_CANDIDATES: Record<string, string[]> = {
  code: ["code", "paint_code", "paint code", "colour_code", "color_code", "paintcode"],
  name: ["name", "color", "colour", "color_name", "colour_name", "marketing_name", "colorname"],
  finish: ["finish", "type", "paint_type", "finish_type"],
  hex: ["hex", "hex_code", "hex_color", "colour_hex", "color_hex", "#hex", "hexcode"],
  r: ["r", "red", "r_value"],
  g: ["g", "green", "g_value"],
  b: ["b", "blue", "b_value"],
  make: ["make", "manufacturer", "brand", "oem", "make_name"],
  model: ["model", "model_name", "vehicle", "car_model"],
  year: ["year", "model_year", "year_from", "yr"]
};

function detectColumns(headers: string[]): Record<string, number> {
  const lc = headers.map((h) => h.toLowerCase().trim());
  const map: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(COL_CANDIDATES)) {
    for (const c of candidates) {
      const idx = lc.indexOf(c);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// CSV parsing (no deps — handles quoted fields with embedded commas)
// ---------------------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
type RawRow = {
  code?: string;
  name?: string;
  finish?: string;
  hex?: string;
  r?: number;
  g?: number;
  b?: number;
  make?: string;
  model?: string;
  year?: number;
};

interface GroupKey {
  make: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Finish normalization
// ---------------------------------------------------------------------------
function normalizeFinish(raw?: string): Finish {
  if (!raw) return "solid";
  const lc = raw.toLowerCase();
  if (lc.includes("matte") || lc.includes("satin") || lc.includes("frozen")) return "matte";
  if (lc.includes("pearl") || lc.includes("tri") || lc.includes("tricoat")) return "pearl";
  if (lc.includes("metallic") || lc.includes("mica") || lc.includes("flake")) return "metallic";
  if (lc === "solid" || lc === "standard") return "solid";
  return "other";
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------
function normalizeHex(raw: string): string | undefined {
  const h = raw.replace("#", "").trim().toUpperCase();
  if (h.length === 6 && /^[0-9A-F]{6}$/.test(h)) return `#${h}`;
  if (h.length === 3 && /^[0-9A-F]{3}$/.test(h)) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return undefined;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0").toUpperCase()}${g
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Seed key deduplication
// ---------------------------------------------------------------------------
function seedKey(s: ColorSeed): string {
  return `${s.code}|${s.marketingName}`;
}

// ---------------------------------------------------------------------------
// Read & parse CSV
// ---------------------------------------------------------------------------
async function readCsv(path: string): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(path, "utf8"),
      crlfDelay: Infinity
    });

    let colMap: Record<string, number> = {};
    let headerParsed = false;
    const rows: RawRow[] = [];

    rl.on("line", (line) => {
      if (!line.trim()) return;
      const fields = parseCsvLine(line);

      if (!headerParsed) {
        colMap = detectColumns(fields);
        headerParsed = true;
        console.log("  Detected columns:", colMap);
        return;
      }

      const get = (field: string): string | undefined => {
        const idx = colMap[field];
        return idx !== undefined ? fields[idx]?.trim() || undefined : undefined;
      };

      const rVal = parseFloat(get("r") ?? "");
      const gVal = parseFloat(get("g") ?? "");
      const bVal = parseFloat(get("b") ?? "");

      rows.push({
        code: get("code"),
        name: get("name"),
        finish: get("finish"),
        hex: get("hex"),
        r: isNaN(rVal) ? undefined : Math.round(rVal),
        g: isNaN(gVal) ? undefined : Math.round(gVal),
        b: isNaN(bVal) ? undefined : Math.round(bVal),
        make: get("make"),
        model: get("model"),
        year: parseInt(get("year") ?? "", 10) || undefined
      });
    });

    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Convert row → seed
// ---------------------------------------------------------------------------
let autoCode = 1;

function rowToSeed(row: RawRow, idx: number): ColorSeed | null {
  let hex: string | undefined;

  if (row.hex) {
    hex = normalizeHex(row.hex);
  }
  if (!hex && row.r !== undefined && row.g !== undefined && row.b !== undefined) {
    const [r, g, b] = [row.r, row.g, row.b];
    if ([r, g, b].every((v) => v >= 0 && v <= 255)) {
      hex = rgbToHex(r, g, b);
    }
  }

  if (!hex) {
    console.warn(`  [skip row ${idx + 2}] No usable hex or RGB values`);
    return null;
  }

  const code = row.code ?? String(autoCode++);
  const name = row.name ?? `Color ${code}`;

  return {
    code,
    marketingName: name,
    finish: normalizeFinish(row.finish),
    hex,
    source: SOURCE_TAG,
    confidence: "derived",
    note: `Derived from ${hex} (${SOURCE_TAG}, row ${idx + 2}). Replace with spectro LAB before production claims.`
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  console.log(`\nImporting CSV: ${CSV_FILE}\n`);

  const rows = await readCsv(CSV_FILE);
  console.log(`\nParsed ${rows.length} data rows.\n`);

  // Group by make+model if those columns exist
  const hasGrouping = rows.some((r) => r.make || r.model);

  type GroupMap = Map<string, { key: GroupKey; seeds: ColorSeed[]; years: number[] }>;
  const groups: GroupMap = new Map();

  const defaultKey = `${MAKE_ARG || "unknown"}|${SCOPE_ID}`;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const seed = rowToSeed(row, i);
    if (!seed) continue;

    const make = (row.make || MAKE_ARG || "unknown").trim();
    const model = (row.model || "").trim();
    const gk = hasGrouping ? `${make}|${model}` : defaultKey;

    if (!groups.has(gk)) {
      groups.set(gk, {
        key: { make, model },
        seeds: [],
        years: []
      });
    }

    const group = groups.get(gk)!;

    // Deduplicate by code+name
    if (!group.seeds.find((s) => seedKey(s) === seedKey(seed))) {
      group.seeds.push(seed);
    }
    if (row.year) group.years.push(row.year);
  }

  // Print summary
  console.log(`\nGroups found: ${groups.size}`);
  for (const [gk, g] of groups) {
    console.log(`  ${gk}: ${g.seeds.length} seeds`);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] No files written.");
    for (const [gk, g] of groups) {
      console.log(`\n[dry-run] Group: ${gk}`);
      console.log("[dry-run] Sample:", JSON.stringify(g.seeds.slice(0, 2), null, 2));
    }
    return;
  }

  // Write scopes
  const written: string[] = [];
  for (const [, g] of groups) {
    const { make, model } = g.key;
    const slug = [SCOPE_ID, make !== "unknown" ? make : "", model]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const years = g.years.length ? g.years : [YEAR_FROM, YEAR_TO];
    const yearFrom = Math.min(...years);
    const yearTo = Math.max(...years);

    const scopeDir = join(repoRoot(), "data/oem", slug);
    const models = model ? [model] : [];

    const meta: ScopeMeta = {
      scopeId: slug,
      oem: make !== "unknown" ? make : MAKE_ARG || "unknown",
      from: yearFrom,
      to: yearTo,
      models,
      notes: `Imported from Kaggle CSV "${basename(CSV_FILE)}". LAB values are hex/RGB-derived; upgrade with spectro data as available.`
    };

    writeScope(scopeDir, meta, g.seeds, RECORDED_AT);
    written.push(slug);
  }

  console.log("\nDone. To register each scope in the validation pipeline,");
  console.log("add the following to src/pipeline/validateData.ts:\n");
  for (const slug of written) {
    console.log(
      `  { schemaId: "https://lacca.local/schemas/exterior-paints-v1.schema.json", dataPath: "data/oem/${slug}/exterior-paints-v1.json" },`
    );
    console.log(
      `  { schemaId: "https://lacca.local/schemas/oem-scope-v1.schema.json", dataPath: "data/oem/${slug}/oem-scope.json" },`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
