/**
 * Fetch exterior paint colors from CarAPI (carapi.app) for a given make/model/year
 * and write them as a valid OEM scope + exterior-paints JSON pair.
 *
 * Usage:
 *   tsx scripts/fetch-carapi-colors.ts \
 *     --make BMW --model "X5" --year 2024 \
 *     --scope-id bmw-x5-2024-v1 \
 *     [--token <CARAPI_TOKEN>] \
 *     [--dry-run]
 *
 * CarAPI free tier: 100 req/day, no auth required for public endpoints.
 * Color data: https://carapi.app/api/colors?year=YEAR&make=MAKE&model=MODEL
 *
 * Output LAB confidence: "derived" (RGB → sRGB → LAB via srgbToLabD65).
 * Upgrade individual rows to "spec" or "measured" manually if better data becomes available.
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
  writeScope
} from "../src/pipeline/seedHelpers.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const MAKE = args["make"];
const MODEL = args["model"];
const YEAR = args["year"];
const SCOPE_ID = args["scope-id"];
const TOKEN = args["token"] ?? process.env["CARAPI_TOKEN"] ?? "";
const DRY_RUN = args["dry-run"] === "true";

if (!MAKE || !MODEL || !YEAR || !SCOPE_ID) {
  console.error(
    "Usage: tsx scripts/fetch-carapi-colors.ts --make <MAKE> --model <MODEL> --year <YEAR> --scope-id <SCOPE_ID> [--token <TOKEN>] [--dry-run]"
  );
  process.exit(1);
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// CarAPI types
// ---------------------------------------------------------------------------
interface CarApiColor {
  id: number;
  name: string;
  hex_code?: string;
  /** RGB as comma-separated string "R,G,B" or array — API may vary */
  rgb?: string | number[];
  category?: string;
}

interface CarApiResponse {
  data: {
    current_page: number;
    last_page: number;
    data: CarApiColor[];
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  return h;
}

async function fetchPage(page: number): Promise<CarApiResponse["data"]> {
  const url =
    `https://carapi.app/api/colors?` +
    new URLSearchParams({
      year: YEAR,
      make: MAKE,
      model: MODEL,
      page: String(page)
    }).toString();

  console.log(`  GET ${url}`);
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CarAPI ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as CarApiResponse;
  return json.data;
}

async function fetchAllColors(): Promise<CarApiColor[]> {
  const first = await fetchPage(1);
  const all: CarApiColor[] = [...first.data];

  for (let p = 2; p <= first.last_page; p++) {
    const page = await fetchPage(p);
    all.push(...page.data);
  }

  return all;
}

// ---------------------------------------------------------------------------
// Color normalization
// ---------------------------------------------------------------------------
function inferFinish(name: string): Finish {
  const lc = name.toLowerCase();
  if (lc.includes("matte") || lc.includes("frozen") || lc.includes("satin")) return "matte";
  if (lc.includes("pearl") || lc.includes("tri-coat") || lc.includes("tricoat")) return "pearl";
  if (
    lc.includes("metallic") ||
    lc.includes("mica") ||
    lc.includes("effect") ||
    lc.includes("flake")
  )
    return "metallic";
  return "solid";
}

function parseHexFromColor(color: CarApiColor): string | undefined {
  if (color.hex_code) {
    const h = color.hex_code.replace("#", "").trim();
    if (h.length === 6) return `#${h.toUpperCase()}`;
  }
  if (color.rgb) {
    let r: number, g: number, b: number;
    if (typeof color.rgb === "string") {
      const parts = color.rgb.split(",").map((x) => parseInt(x.trim(), 10));
      [r, g, b] = parts;
    } else {
      [r, g, b] = color.rgb as number[];
    }
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return `#${r.toString(16).padStart(2, "0").toUpperCase()}${g
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`;
    }
  }
  return undefined;
}

function colorToSeed(color: CarApiColor, idx: number): ColorSeed | null {
  const hex = parseHexFromColor(color);
  if (!hex) {
    console.warn(`  [skip] "${color.name}" — no usable hex/rgb (id=${color.id})`);
    return null;
  }

  const code = String(color.id);
  const marketingName = color.name.trim();

  return {
    code,
    marketingName,
    finish: inferFinish(marketingName),
    hex,
    source: "carapi",
    confidence: "derived",
    provenanceId: `carapi:${color.id}`,
    note: `Derived from ${hex} (CarAPI id=${color.id}, category=${color.category ?? "n/a"}). Replace with spectro LAB before production claims.`
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  console.log(`\nFetching CarAPI colors for ${MAKE} ${MODEL} ${YEAR}…\n`);

  const colors = await fetchAllColors();
  console.log(`\nReceived ${colors.length} color entries from CarAPI.`);

  const seeds: ColorSeed[] = [];
  for (let i = 0; i < colors.length; i++) {
    const seed = colorToSeed(colors[i], i);
    if (seed) seeds.push(seed);
  }

  console.log(`Converted ${seeds.length} / ${colors.length} entries to seeds.\n`);

  if (seeds.length === 0) {
    console.error("No usable colors found. Check make/model/year or try with a --token.");
    process.exit(1);
  }

  const scopeDir = join(repoRoot(), "data/oem", SCOPE_ID);
  const meta: ScopeMeta = {
    scopeId: SCOPE_ID,
    oem: MAKE,
    from: parseInt(YEAR, 10),
    to: parseInt(YEAR, 10),
    models: [MODEL],
    notes: `${MAKE} ${MODEL} ${YEAR} exterior colors fetched from CarAPI (carapi.app). LAB values are RGB-derived; upgrade individual rows with spectro data as available.`
  };

  if (DRY_RUN) {
    console.log("[dry-run] Would write to:", scopeDir);
    console.log("[dry-run] Scope meta:", JSON.stringify(meta, null, 2));
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
