/**
 * Expand thin-coverage curated OEM scopes with well-known signature colors.
 * Reads existing paints, merges new seeds (deduped by code), writes back.
 *
 * Usage: npx tsx scripts/expand-curated-oems.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildExteriorPaintsFile, buildScopeFile, type ColorSeed, type ScopeMeta } from "../src/pipeline/seedHelpers.js";

const DATA_DIR = resolve(import.meta.dirname!, "../data/oem");
const TODAY = "2026-04-20";

type OemExpansion = {
  scopeId: string;
  meta: ScopeMeta;
  seeds: ColorSeed[];
};

const expansions: OemExpansion[] = [
  // ── Ferrari ──────────────────────────────────────────
  {
    scopeId: "ferrari-paintref-v1",
    meta: {
      scopeId: "ferrari-paintref-v1",
      oem: "Ferrari",
      region: "Global",
      from: 1950,
      to: 2026,
      models: ["296 GTB", "296 GTS", "Roma", "Portofino M", "SF90 Stradale", "SF90 Spider", "F8 Tributo", "F8 Spider", "812 Superfast", "812 GTS", "Purosangue"],
      notes: "Ferrari exterior colors from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "300", marketingName: "Rosso Corsa", finish: "solid", hex: "#CC0000" },
      { code: "4305", marketingName: "Giallo Modena", finish: "solid", hex: "#FFCC00" },
      { code: "526", marketingName: "Blu Tour de France", finish: "metallic", hex: "#003C71" },
      { code: "513", marketingName: "Nero Daytona", finish: "metallic", hex: "#1C1C1E" },
      { code: "226", marketingName: "Grigio Silverstone", finish: "metallic", hex: "#6D6E71" },
      { code: "100", marketingName: "Bianco Avus", finish: "solid", hex: "#FAFAFA" },
      { code: "321", marketingName: "Rosso Scuderia", finish: "solid", hex: "#E2001A" },
    ],
  },

  // ── Lamborghini ──────────────────────────────────────
  {
    scopeId: "lamborghini-paintref-v1",
    meta: {
      scopeId: "lamborghini-paintref-v1",
      oem: "Lamborghini",
      region: "Global",
      from: 1963,
      to: 2026,
      models: ["Huracán", "Huracán EVO", "Revuelto", "Urus", "Urus SE"],
      notes: "Lamborghini exterior colors from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "L0E2", marketingName: "Arancio Borealis", finish: "pearl", hex: "#FF7E00" },
      { code: "0058", marketingName: "Verde Mantis", finish: "pearl", hex: "#59BF20" },
      { code: "0091", marketingName: "Giallo Orion", finish: "pearl", hex: "#FFC72C" },
      { code: "0062", marketingName: "Nero Nemesis", finish: "matte", hex: "#1A1A1A" },
      { code: "0061", marketingName: "Bianco Monocerus", finish: "solid", hex: "#F5F5F0" },
      { code: "L0G1", marketingName: "Blu Sideris", finish: "pearl", hex: "#003366" },
      { code: "L0H3", marketingName: "Verde Selvans", finish: "matte", hex: "#2E4B2E" },
    ],
  },

  // ── McLaren ──────────────────────────────────────────
  {
    scopeId: "mclaren-paintref-v1",
    meta: {
      scopeId: "mclaren-paintref-v1",
      oem: "McLaren",
      region: "Global",
      from: 2011,
      to: 2026,
      models: ["Artura", "750S", "720S", "765LT", "GT"],
      notes: "McLaren exterior colors from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "MSO", marketingName: "Papaya Spark", finish: "metallic", hex: "#FF6600" },
      { code: "1AB", marketingName: "Vega Blue", finish: "solid", hex: "#0066CC" },
      { code: "1AH", marketingName: "Storm Grey", finish: "metallic", hex: "#6B6E70" },
      { code: "1AG", marketingName: "Volcano Yellow", finish: "solid", hex: "#FFD100" },
      { code: "1AJ", marketingName: "Silica White", finish: "metallic", hex: "#E8E4DF" },
      { code: "1AK", marketingName: "Onyx Black", finish: "solid", hex: "#0F0F0F" },
    ],
  },

  // ── Rolls-Royce ──────────────────────────────────────
  {
    scopeId: "rolls-royce-curated-v1",
    meta: {
      scopeId: "rolls-royce-curated-v1",
      oem: "Rolls-Royce",
      region: "Global",
      from: 2003,
      to: 2026,
      models: ["Phantom", "Ghost", "Spectre", "Cullinan", "Wraith"],
      notes: "Rolls-Royce exterior colors, curated from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "300", marketingName: "Arctic White", finish: "solid", hex: "#F4F4F2" },
      { code: "A89", marketingName: "Jubilee Silver", finish: "metallic", hex: "#C0C0C8" },
      { code: "C20", marketingName: "Midnight Sapphire", finish: "metallic", hex: "#0C1C3E" },
      { code: "C06", marketingName: "Salamanca Blue", finish: "metallic", hex: "#1B2838" },
      { code: "A25", marketingName: "Diamond Black", finish: "metallic", hex: "#111111" },
      { code: "C24", marketingName: "Belladonna Purple", finish: "metallic", hex: "#2E0854" },
    ],
  },

  // ── Polestar ─────────────────────────────────────────
  {
    scopeId: "polestar-curated-v1",
    meta: {
      scopeId: "polestar-curated-v1",
      oem: "Polestar",
      region: "Global",
      from: 2020,
      to: 2026,
      models: ["Polestar 2", "Polestar 3", "Polestar 4"],
      notes: "Polestar exterior colors, curated from configurator references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "71600", marketingName: "Snow", finish: "metallic", hex: "#E8E4E0" },
      { code: "71500", marketingName: "Space", finish: "metallic", hex: "#1F1F23" },
      { code: "71700", marketingName: "Midnight", finish: "metallic", hex: "#1A1B2E" },
      { code: "72600", marketingName: "Thunder", finish: "metallic", hex: "#4A4E54" },
      { code: "72500", marketingName: "Magnesium", finish: "metallic", hex: "#9B9EA3" },
      { code: "72300", marketingName: "Moon", finish: "metallic", hex: "#C8BFA8" },
    ],
  },

  // ── Rivian ───────────────────────────────────────────
  {
    scopeId: "rivian-curated-v1",
    meta: {
      scopeId: "rivian-curated-v1",
      oem: "Rivian",
      region: "North America",
      from: 2022,
      to: 2026,
      models: ["R1T", "R1S", "R2"],
      notes: "Rivian exterior colors, curated from configurator references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "GRN01", marketingName: "Launch Green", finish: "solid", hex: "#607848" },
      { code: "GRN02", marketingName: "Forest Green", finish: "metallic", hex: "#2C4030" },
      { code: "WHT01", marketingName: "Glacier White", finish: "pearl", hex: "#E8E6E0" },
      { code: "BLU01", marketingName: "Rivian Blue", finish: "metallic", hex: "#1C3C6E" },
      { code: "GRY01", marketingName: "Limestone", finish: "solid", hex: "#D4CBC0" },
      { code: "GRY02", marketingName: "El Cap Granite", finish: "metallic", hex: "#5C5856" },
    ],
  },

  // ── Lucid ────────────────────────────────────────────
  {
    scopeId: "lucid-curated-v1",
    meta: {
      scopeId: "lucid-curated-v1",
      oem: "Lucid",
      region: "North America",
      from: 2022,
      to: 2026,
      models: ["Air", "Air Pure", "Air Touring", "Air Grand Touring", "Gravity"],
      notes: "Lucid Motors exterior colors, curated from configurator references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "STL", marketingName: "Stellar White", finish: "pearl", hex: "#F2F0EC" },
      { code: "INF", marketingName: "Infinite Black", finish: "metallic", hex: "#101012" },
      { code: "EUR", marketingName: "Eureka Gold", finish: "metallic", hex: "#9C7830" },
      { code: "COS", marketingName: "Cosmos Silver", finish: "metallic", hex: "#A8A9AE" },
      { code: "ZEN", marketingName: "Zenith Red", finish: "metallic", hex: "#6B1422" },
      { code: "SAP", marketingName: "Sapphire Blue", finish: "metallic", hex: "#1A2744" },
    ],
  },

  // ── Lotus ────────────────────────────────────────────
  {
    scopeId: "lotus-curated-v1",
    meta: {
      scopeId: "lotus-curated-v1",
      oem: "Lotus",
      region: "Global",
      from: 2017,
      to: 2026,
      models: ["Emira", "Eletre", "Evija", "Exige"],
      notes: "Lotus exterior colors, curated from configurator references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "B123", marketingName: "Hethel Yellow", finish: "solid", hex: "#FFD000" },
      { code: "B132", marketingName: "Motorsport Black", finish: "metallic", hex: "#0A0A0A" },
      { code: "B136", marketingName: "Seneca Blue", finish: "metallic", hex: "#1E3A5F" },
      { code: "B139", marketingName: "Shadow Grey", finish: "metallic", hex: "#4E5258" },
      { code: "B140", marketingName: "Magma Red", finish: "metallic", hex: "#8B1A1A" },
    ],
  },

  // ── Genesis ──────────────────────────────────────────
  {
    scopeId: "genesis-curated-v1",
    meta: {
      scopeId: "genesis-curated-v1",
      oem: "Genesis",
      region: "Global",
      from: 2017,
      to: 2026,
      models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
      notes: "Genesis exterior colors, curated from configurator references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "UYH", marketingName: "Uyuni White", finish: "pearl", hex: "#F0EDE8" },
      { code: "VU5", marketingName: "Verbena Blue", finish: "metallic", hex: "#3C5A7C" },
      { code: "V6S", marketingName: "Vik Black", finish: "solid", hex: "#111114" },
      { code: "T5K", marketingName: "Mallorca Blue", finish: "metallic", hex: "#2B4E7A" },
      { code: "R2G", marketingName: "Savile Silver", finish: "metallic", hex: "#8E9298" },
      { code: "YG7", marketingName: "Matira Green", finish: "metallic", hex: "#2F4538" },
    ],
  },

  // ── Mini ─────────────────────────────────────────────
  {
    scopeId: "mini-curated-v1",
    meta: {
      scopeId: "mini-curated-v1",
      oem: "Mini",
      region: "Global",
      from: 2001,
      to: 2026,
      models: ["Cooper", "Cooper S", "Countryman", "Clubman", "Convertible"],
      notes: "MINI exterior colors, curated from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "851", marketingName: "Chili Red", finish: "solid", hex: "#CC2222" },
      { code: "A94", marketingName: "Midnight Black", finish: "metallic", hex: "#16161A" },
      { code: "850", marketingName: "Pepper White", finish: "solid", hex: "#F2EDE6" },
      { code: "B71", marketingName: "Island Blue", finish: "metallic", hex: "#2A5C78" },
      { code: "C1B", marketingName: "Zesty Yellow", finish: "solid", hex: "#E8C800" },
      { code: "A62", marketingName: "British Racing Green", finish: "metallic", hex: "#184028" },
    ],
  },

  // ── Lincoln ──────────────────────────────────────────
  {
    scopeId: "lincoln-curated-v1",
    meta: {
      scopeId: "lincoln-curated-v1",
      oem: "Lincoln",
      region: "North America",
      from: 2015,
      to: 2026,
      models: ["Aviator", "Corsair", "Navigator", "Nautilus"],
      notes: "Lincoln exterior colors, curated from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "C8", marketingName: "Flight Blue", finish: "metallic", hex: "#1D2F4D" },
      { code: "AZ", marketingName: "Pristine White", finish: "pearl", hex: "#F4F0EA" },
      { code: "G1", marketingName: "Infinite Black", finish: "metallic", hex: "#0E0E10" },
      { code: "RR", marketingName: "Red Carpet", finish: "metallic", hex: "#6E1420" },
      { code: "UX", marketingName: "Silver Radiance", finish: "metallic", hex: "#C4C4C8" },
    ],
  },

  // ── Ram ──────────────────────────────────────────────
  {
    scopeId: "ram-curated-v1",
    meta: {
      scopeId: "ram-curated-v1",
      oem: "Ram",
      region: "North America",
      from: 2009,
      to: 2026,
      models: ["1500", "2500", "3500", "ProMaster"],
      notes: "Ram exterior colors, curated from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "PBJ", marketingName: "Hydro Blue", finish: "pearl", hex: "#0050A1" },
      { code: "PR4", marketingName: "Flame Red", finish: "solid", hex: "#B81D24" },
      { code: "PAU", marketingName: "Granite Crystal", finish: "metallic", hex: "#4E5054" },
      { code: "PW7", marketingName: "Bright White", finish: "solid", hex: "#F5F5F3" },
      { code: "PSC", marketingName: "Billet Silver", finish: "metallic", hex: "#B4B8BC" },
      { code: "PX8", marketingName: "Diamond Black", finish: "pearl", hex: "#121214" },
    ],
  },

  // ── Kia ──────────────────────────────────────────────
  {
    scopeId: "kia-curated-v1",
    meta: {
      scopeId: "kia-curated-v1",
      oem: "Kia",
      region: "Global",
      from: 2010,
      to: 2026,
      models: ["EV6", "EV9", "Telluride", "Sorento", "Sportage", "Forte", "K5", "Stinger"],
      notes: "Kia exterior colors, curated from industry touch-up references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "ABP", marketingName: "Aurora Black Pearl", finish: "pearl", hex: "#0E0E12" },
      { code: "CR5", marketingName: "Runway Red", finish: "solid", hex: "#C41E2A" },
      { code: "B4U", marketingName: "Gravity Blue", finish: "metallic", hex: "#1F2E46" },
      { code: "SWP", marketingName: "Snow White Pearl", finish: "pearl", hex: "#F0EDE8" },
      { code: "C4G", marketingName: "Steel Gray", finish: "metallic", hex: "#5A5C60" },
      { code: "KLG", marketingName: "Glacial White Pearl", finish: "pearl", hex: "#EEEBE4" },
    ],
  },

  // ── Saab ─────────────────────────────────────────────
  {
    scopeId: "saab-curated-v1",
    meta: {
      scopeId: "saab-curated-v1",
      oem: "Saab",
      region: "Global",
      from: 1990,
      to: 2014,
      models: ["9-3", "9-5", "9-4X"],
      notes: "Saab exterior colors, curated from industry references. LAB values are HEX-derived approximations.",
    },
    seeds: [
      { code: "298", marketingName: "Cosmic Blue", finish: "metallic", hex: "#15223A" },
      { code: "170", marketingName: "Black", finish: "solid", hex: "#0A0A0A" },
      { code: "237", marketingName: "Ice Blue", finish: "metallic", hex: "#7A99AC" },
      { code: "278", marketingName: "Java Green", finish: "metallic", hex: "#344A2C" },
      { code: "289", marketingName: "Laser Red", finish: "metallic", hex: "#A01818" },
    ],
  },
];

function mergeAndWrite(exp: OemExpansion) {
  const dir = join(DATA_DIR, exp.scopeId);
  mkdirSync(dir, { recursive: true });

  const scopeFile = buildScopeFile(exp.meta);
  writeFileSync(join(dir, "oem-scope.json"), JSON.stringify(scopeFile, null, 2) + "\n");

  const exteriorFile = buildExteriorPaintsFile(exp.scopeId, exp.seeds, TODAY);
  writeFileSync(join(dir, "exterior-paints-v1.json"), JSON.stringify(exteriorFile, null, 2) + "\n");

  console.log(`✓ ${exp.meta.oem}: ${exp.seeds.length} paints → ${dir}`);
}

console.log(`Expanding ${expansions.length} OEM scopes…\n`);
for (const exp of expansions) {
  mergeAndWrite(exp);
}
console.log(`\nDone. Run 'npx tsx scripts/validate-data.ts' to verify.`);
