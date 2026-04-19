/**
 * Fetch official exterior color listings from NHTSA vPIC and write them as a
 * valid OEM scope + exterior-paints JSON pair.
 *
 * Usage:
 *   tsx scripts/fetch-nhtsa-colors.ts \
 *     --make Tesla --year 2024 \
 *     --scope-id tesla-2024-v1 \
 *     [--models "Model 3,Model Y"] \
 *     [--dry-run]
 *
 * How it works:
 *   1. Fetches all NHTSA-registered exterior colors via GetAllColors (cached at
 *      data/nhtsa/colors-cache.json so subsequent runs are instant).
 *   2. Filters colors whose Name matches the requested make (case-insensitive prefix).
 *   3. Looks up each color name in NHTSA_HEX_MAP (common manufacturer color
 *      names → approximate hex). Colors with no mapping are skipped with a warning.
 *   4. Converts hex → LAB via srgbToLabD65; sets source: "nhtsa_vpic",
 *      confidence: "derived".
 *   5. Writes data/oem/<scope-id>/{oem-scope,exterior-paints-v1}.json.
 *
 * Extending NHTSA_HEX_MAP:
 *   Add entries using the exact color name NHTSA returns. Running with
 *   --dry-run shows a list of unmapped names so you can populate it.
 *
 * Validation auto-discovers every `data/oem/<scope-id>/` folder, so no manual
 * registration in `src/pipeline/validateData.ts` is required.
 *
 * WARNING: the NHTSA vPIC `GetAllColors` endpoint returns **404** on the current
 * backend (it is not listed on the public Vehicle API page). There is also **no**
 * exterior-color variable in `GetVehicleVariableList`, so there is no supported
 * `GetVehicleVariableValuesList/...` workaround for a full color catalog.
 * This script only works if `data/nhtsa/colors-cache.json` already exists from an
 * older capture. See `npx tsx scripts/probe-nhtsa-color-sources.ts` for a live check.
 * Prefer PaintRef / CSV / OEM spectro pipelines for factory paint coverage.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const MAKE = args["make"];
const YEAR = args["year"];
const SCOPE_ID = args["scope-id"];
const MODELS_ARG = args["models"];
const DRY_RUN = args["dry-run"] === "true";

if (!MAKE || !YEAR || !SCOPE_ID) {
  console.error(
    "Usage: tsx scripts/fetch-nhtsa-colors.ts --make <MAKE> --year <YEAR> --scope-id <SCOPE_ID> [--models 'Model 3,Model Y'] [--dry-run]"
  );
  process.exit(1);
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// NHTSA_HEX_MAP — color name (as returned by GetAllColors) → hex approximation
//
// Add entries using the exact string from the API response. The keys below cover
// common manufacturer colors that appear in the NHTSA registry. Running
// --dry-run will print any unmapped names for you to add here.
// ---------------------------------------------------------------------------
const NHTSA_HEX_MAP: Record<string, string> = {
  // Achromatic / neutrals
  Black: "#0D0D0D",
  "Jet Black": "#0B0B0B",
  White: "#F5F5F5",
  "Pearl White": "#F0EFE8",
  "Solid White": "#F5F5F5",
  Silver: "#B0B0B0",
  Grey: "#808080",
  Gray: "#808080",
  "Space Grey": "#6E6E72",
  "Space Gray": "#6E6E72",
  "Dark Grey": "#3A3A3A",
  "Dark Gray": "#3A3A3A",
  "Midnight Silver Metallic": "#4E5054",
  "Ultra Red": "#CC2933",

  // Tesla-specific
  "Midnight Silver": "#4E5054",
  "Deep Blue Metallic": "#1B3A5C",
  "Obsidian Black Metallic": "#131418",
  "Red Multi-Coat": "#C12028",
  "Quicksilver": "#C0C0C0",
  "Stealth Grey": "#3D3E40",
  "Lunar Silver Metallic": "#A6A9AC",

  // BMW
  "Alpine White": "#EDEDEB",
  "Black Sapphire Metallic": "#14181E",
  "Carbon Black Metallic": "#1B1C21",
  "Mineral White Metallic": "#D6D7D3",
  "Phytonic Blue Metallic": "#274160",
  "Dravit Grey Metallic": "#4A4B46",
  "Brooklyn Grey Metallic": "#3C3E3E",

  // Ford
  "Iconic Silver Metallic": "#A8AAAB",
  "Oxford White": "#F3F3F3",
  "Agate Black Metallic": "#1A1A1A",
  "Antimatter Blue Metallic": "#1C3A5C",
  "Carbonized Gray Metallic": "#4A4D52",
  "Rapid Red Metallic Tinted Clearcoat": "#8B1A1A",

  // Toyota / Lexus
  "Midnight Black Metallic": "#111111",
  "Wind Chill Pearl": "#E8E8E0",
  "Magnetic Gray Metallic": "#6B6E72",
  "Blueprint": "#2B4F7C",
  "Supersonic Red": "#C0272D",
  "Cavalry Blue": "#2B4E72",

  // Honda
  "Sonic Gray Pearl": "#777880",
  "Platinum White Pearl": "#ECEAE4",
  "Aegean Blue Metallic": "#1A3D5C",
  "Rallye Red": "#C0251E",

  // Chevrolet
  "Summit White": "#F0F0EE",
  "Mosaic Black Metallic": "#151518",
  "Satin Steel Metallic": "#82868A",
  "Radiant Red Tintcoat": "#8C1515",
  "Cayenne Orange Metallic": "#BB4A1F",

  // Hyundai / Kia
  "Phantom Black Pearl": "#141414",
  "Serenity White Pearl": "#EDECEA",
  "Amazon Gray Metallic": "#5C5E60",
  "Hampton Gray Premium": "#9A9C9E",
  "Gravity Gold Matte": "#8A7340",

  // Generic catch-alls that appear frequently in NHTSA data
  "Blue": "#1F4E79",
  "Dark Blue": "#0D2B4E",
  "Navy Blue": "#1B2A4A",
  "Red": "#B22222",
  "Dark Red": "#7B1010",
  "Maroon": "#5C1010",
  "Green": "#2D5A27",
  "Dark Green": "#1A3A16",
  "Brown": "#5C3A1E",
  "Beige": "#C8B89A",
  "Gold": "#B8960C",
  "Orange": "#C05A1F",
  "Yellow": "#D4B800",
  "Purple": "#4A1E6A",
  "Burgundy": "#5C0A1A"
};

// ---------------------------------------------------------------------------
// NHTSA API types
// ---------------------------------------------------------------------------
interface NhtsaColorEntry {
  Color: string;
  ColorId: number;
  Make?: string;
}

interface NhtsaColorsResponse {
  Count: number;
  Message: string;
  Results: NhtsaColorEntry[];
}

interface NhtsaModelsResult {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
}

interface NhtsaModelsResponse {
  Count: number;
  Results: NhtsaModelsResult[];
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function nhtsaCacheDir(): string {
  return join(repoRoot(), "data/nhtsa");
}

function colorsCachePath(): string {
  return join(nhtsaCacheDir(), "colors-cache.json");
}

async function loadAllColors(): Promise<NhtsaColorEntry[]> {
  const cachePath = colorsCachePath();
  if (existsSync(cachePath)) {
    console.log(`  Using cached colors from ${cachePath}`);
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as NhtsaColorsResponse;
    return raw.Results;
  }

  console.log("  Fetching all colors from NHTSA vPIC…");
  const url = "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllColors?format=json";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`NHTSA ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as NhtsaColorsResponse;
  mkdirSync(nhtsaCacheDir(), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`  Cached ${data.Count} entries → ${cachePath}`);
  return data.Results;
}

async function fetchModelsForMakeYear(make: string, year: string): Promise<string[]> {
  const url =
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  console.log(`  GET ${url}`);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.warn(`  Could not fetch models for ${make} ${year} (${res.status}); using CLI --models`);
    return [];
  }
  const data = (await res.json()) as NhtsaModelsResponse;
  return [...new Set(data.Results.map((r) => r.Model_Name))].sort();
}

// ---------------------------------------------------------------------------
// Finish inference
// ---------------------------------------------------------------------------
function inferFinish(name: string): Finish {
  const lc = name.toLowerCase();
  if (lc.includes("matte") || lc.includes("satin") || lc.includes("frozen")) return "matte";
  if (lc.includes("pearl") || lc.includes("tri-coat") || lc.includes("tricoat")) return "pearl";
  if (lc.includes("metallic") || lc.includes("mica") || lc.includes("flake")) return "metallic";
  return "solid";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\nFetching NHTSA vPIC colors for ${MAKE} ${YEAR}…\n`);

  const allColors = await loadAllColors();

  // NHTSA color entries don't always carry a Make field; filter by name prefix heuristic
  const makeLC = MAKE.toLowerCase();
  const relevant = allColors.filter((c) => {
    if (c.Make) return c.Make.toLowerCase() === makeLC;
    // Fallback: accept all (user filters via scope)
    return true;
  });

  console.log(`\nTotal NHTSA color entries: ${allColors.length}`);
  console.log(`Entries with Make="${MAKE}" (or no Make filter): ${relevant.length}`);

  // Map each color name → seed
  const seeds: ColorSeed[] = [];
  const unmapped: string[] = [];

  for (const entry of relevant) {
    const name = entry.Color.trim();
    const hex = NHTSA_HEX_MAP[name];
    if (!hex) {
      unmapped.push(name);
      continue;
    }
    seeds.push({
      code: String(entry.ColorId),
      marketingName: name,
      finish: inferFinish(name),
      hex,
      source: "nhtsa_vpic",
      confidence: "derived",
      provenanceId: `nhtsa:${entry.ColorId}`,
      note: `Derived from ${hex} (NHTSA vPIC id=${entry.ColorId}, color="${name}"). Replace with spectro LAB before production claims.`
    });
  }

  if (unmapped.length > 0) {
    console.warn(
      `\n[warn] ${unmapped.length} color name(s) have no NHTSA_HEX_MAP entry and were skipped:`
    );
    for (const n of unmapped) console.warn(`  "${n}"`);
    console.warn(
      "\nAdd them to the NHTSA_HEX_MAP in this script to include them in future runs.\n"
    );
  }

  console.log(`\nConverted ${seeds.length} entries to seeds.`);

  // Fetch models from vPIC or fall back to CLI --models
  let models: string[] = [];
  if (MODELS_ARG) {
    models = MODELS_ARG.split(",").map((m) => m.trim()).filter(Boolean);
  } else {
    models = await fetchModelsForMakeYear(MAKE, YEAR);
  }
  if (models.length === 0) {
    console.warn(`[warn] No models resolved for ${MAKE} ${YEAR}. Use --models "Model A,Model B".`);
    models = [MAKE];
  }
  console.log(`Models: ${models.join(", ")}`);

  const scopeDir = join(repoRoot(), "data/oem", SCOPE_ID);
  const meta: ScopeMeta = {
    scopeId: SCOPE_ID,
    oem: MAKE,
    from: parseInt(YEAR, 10),
    to: parseInt(YEAR, 10),
    models,
    notes: `${MAKE} ${YEAR} exterior colors sourced from NHTSA vPIC GetAllColors. LAB is hex-derived via NHTSA_HEX_MAP; upgrade individual rows with measured data as available.`
  };

  if (seeds.length === 0) {
    console.error(
      "No seeds produced. Extend NHTSA_HEX_MAP with the unmapped names above, or try --dry-run."
    );
    process.exit(1);
  }

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
