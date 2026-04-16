/**
 * Seed a reference scope for the RAL Classic palette — the industrial color
 * standard used on many commercial/fleet vehicles (Sprinter vans, Transit,
 * Iveco, MAN, etc.) and on some passenger cars as cataloged options.
 *
 * The entries written here use hex approximations (derived confidence). RAL
 * publishes official CIELAB/sRGB values per code; when you get authoritative
 * LAB from their spec sheet, swap the per-color `lab:` fields in to upgrade
 * each row to `confidence: "spec"` (or `"measured"` for a calibrated
 * spectrophotometer reading). The schema tolerates mixed confidence within a
 * single scope, so upgrades can be incremental.
 *
 * The resulting scope has `models: []` so it is not displayed directly in the
 * web UI; instead, `merge-oem-scopes.ts` can include it as an additional
 * source when building a canonical OEM scope (useful when a manufacturer
 * offers RAL codes as factory options).
 *
 * Source for the hex swatches:
 *   Published RAL Classic reference swatches (widely cited by paint suppliers).
 *   These match display-side renderings; the authoritative CIELAB is on the
 *   RAL spec sheet and should be preferred for production claims.
 *
 * Usage:
 *   npm run seed:ral
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type Finish,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";

type Entry = { code: string; name: string; hex: string; finish?: Finish };

/**
 * Curated list of RAL Classic colors that actually appear on vehicles.
 * Not exhaustive — focus is on swatches that show up in refinish contexts.
 * Add rows as you encounter new codes in the wild.
 */
const RAL_ENTRIES: Entry[] = [
  { code: "RAL 1001", name: "Beige", hex: "#C2B078" },
  { code: "RAL 1013", name: "Oyster White", hex: "#EAE6CA" },
  { code: "RAL 1014", name: "Ivory", hex: "#DFCEA1" },
  { code: "RAL 1015", name: "Light Ivory", hex: "#EADEBD" },
  { code: "RAL 1018", name: "Zinc Yellow", hex: "#F9BA00" },
  { code: "RAL 1023", name: "Traffic Yellow", hex: "#F7B500" },
  { code: "RAL 1028", name: "Melon Yellow", hex: "#FF9B00" },
  { code: "RAL 2004", name: "Pure Orange", hex: "#F44611" },
  { code: "RAL 2009", name: "Traffic Orange", hex: "#E55B13" },
  { code: "RAL 3000", name: "Flame Red", hex: "#AF2B1E" },
  { code: "RAL 3002", name: "Carmine Red", hex: "#9B111E" },
  { code: "RAL 3003", name: "Ruby Red", hex: "#9B111E" },
  { code: "RAL 3004", name: "Purple Red", hex: "#6D1F1F" },
  { code: "RAL 3020", name: "Traffic Red", hex: "#CC0605" },
  { code: "RAL 5002", name: "Ultramarine Blue", hex: "#20214F" },
  { code: "RAL 5005", name: "Signal Blue", hex: "#1E5E9C" },
  { code: "RAL 5010", name: "Gentian Blue", hex: "#0E294B" },
  { code: "RAL 5013", name: "Cobalt Blue", hex: "#1D334A" },
  { code: "RAL 5015", name: "Sky Blue", hex: "#2874A6" },
  { code: "RAL 5017", name: "Traffic Blue", hex: "#063971" },
  { code: "RAL 6002", name: "Leaf Green", hex: "#2D5016" },
  { code: "RAL 6005", name: "Moss Green", hex: "#114232" },
  { code: "RAL 6018", name: "Yellow Green", hex: "#57A639" },
  { code: "RAL 7001", name: "Silver Grey", hex: "#8F999F" },
  { code: "RAL 7016", name: "Anthracite Grey", hex: "#293133" },
  { code: "RAL 7035", name: "Light Grey", hex: "#C5C7C4" },
  { code: "RAL 7037", name: "Dusty Grey", hex: "#7D7F7D" },
  { code: "RAL 7042", name: "Traffic Grey A", hex: "#8F9695" },
  { code: "RAL 7043", name: "Traffic Grey B", hex: "#4E5452" },
  { code: "RAL 8017", name: "Chocolate Brown", hex: "#442F29" },
  { code: "RAL 8019", name: "Grey Brown", hex: "#3D3635" },
  { code: "RAL 9001", name: "Cream", hex: "#FDF4E3" },
  { code: "RAL 9002", name: "Grey White", hex: "#E7EBDA" },
  { code: "RAL 9003", name: "Signal White", hex: "#F4F4F4" },
  { code: "RAL 9005", name: "Jet Black", hex: "#0A0A0A" },
  { code: "RAL 9006", name: "White Aluminium", hex: "#A5A5A5" },
  { code: "RAL 9007", name: "Grey Aluminium", hex: "#8F8F8F", finish: "metallic" },
  { code: "RAL 9010", name: "Pure White", hex: "#FFFFFF" },
  { code: "RAL 9016", name: "Traffic White", hex: "#F6F6F6" },
  { code: "RAL 9017", name: "Traffic Black", hex: "#1E1E1E" }
];

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

const SCOPE_ID = "ral-classic-v1";
const RECORDED_AT = new Date().toISOString().slice(0, 10);

const seeds: ColorSeed[] = RAL_ENTRIES.map((e) => ({
  code: e.code,
  marketingName: e.name,
  finish: e.finish ?? "solid",
  hex: e.hex,
  source: "ral_classic_hex",
  confidence: "derived",
  provenanceId: `ral_classic:${e.code.replace(/\s+/g, "")}`,
  note:
    `Derived from RAL Classic reference hex ${e.hex}. ` +
    `RAL publishes official CIELAB values; replace this entry with the spec LAB ` +
    `and upgrade to confidence="spec" when available.`
}));

const meta: ScopeMeta = {
  scopeId: SCOPE_ID,
  oem: "RAL",
  from: 1927,
  to: new Date().getFullYear(),
  models: [],
  notes:
    "RAL Classic color standard. Reference palette for commercial/fleet vehicles and RAL-option factory paints. " +
    "Hex-derived today; swap per-color LAB from the RAL spec sheet to upgrade to spec/measured confidence. " +
    "Not displayed in the vehicle picker (models: []); used as an input to merge-oem-scopes for makes with RAL options."
};

writeScope(join(repoRoot(), "data/oem", SCOPE_ID), meta, seeds, RECORDED_AT);
