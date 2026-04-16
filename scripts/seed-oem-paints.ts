import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ColorSeed,
  type ScopeMeta,
  writeScope
} from "../src/pipeline/seedHelpers.js";

/**
 * Seed OEM paint datasets from HEX approximations.
 *
 * HEX values are sourced from industry touch-up references (AutomotiveTouchup,
 * TouchUpDirect, ERA Paints, enthusiast color cards). They are NOT spectro
 * measurements — each entry is stored with confidence: "derived" and source:
 * "hex_derived" per schemas/lab-measurement-v1.schema.json so downstream code
 * can treat them as prototype-grade.
 *
 * Replace with measured LAB (confidence: "measured", source: "spectro_reread")
 * before production claims.
 */

const RECORDED_AT = "2026-04-16";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}

// ------------------------------------------------------------------
// BMW X-line (X1, X2, X3, X4, X5, X6, X7, iX, XM)
// ------------------------------------------------------------------
const BMW_X: ColorSeed[] = [
  { code: "300", marketingName: "Alpine White III", finish: "solid", hex: "#EDEDEB" },
  { code: "668", marketingName: "Jet Black", finish: "solid", hex: "#0B0B0B" },
  { code: "A96", marketingName: "Mineral White Metallic", finish: "metallic", hex: "#D6D7D3" },
  { code: "416", marketingName: "Carbon Black Metallic", finish: "metallic", hex: "#1B1C21" },
  { code: "475", marketingName: "Black Sapphire Metallic", finish: "metallic", hex: "#14181E" },
  { code: "C27", marketingName: "Phytonic Blue Metallic", finish: "metallic", hex: "#274160" },
  { code: "C31", marketingName: "Sunset Orange Metallic", finish: "metallic", hex: "#A33A1B" },
  { code: "C3Z", marketingName: "Tanzanite Blue II Metallic", finish: "metallic", hex: "#1F2F45" },
  { code: "C1M", marketingName: "Portimao Blue Metallic (M)", finish: "metallic", hex: "#234C7A" },
  { code: "C4E", marketingName: "Skyscraper Grey Metallic (M)", finish: "metallic", hex: "#535867" },
  { code: "C2Y", marketingName: "Dravit Grey Metallic", finish: "metallic", hex: "#4A4B46" },
  { code: "C06", marketingName: "Brooklyn Grey Metallic", finish: "metallic", hex: "#3C3E3E" },
  { code: "C4F", marketingName: "Cape York Green Metallic", finish: "metallic", hex: "#2E4436" },
  { code: "P0F", marketingName: "Frozen Portimao Blue Metallic (M)", finish: "matte", hex: "#2C547C" }
];

const BMW_X_META: ScopeMeta = {
  scopeId: "bmw-x-v1",
  oem: "BMW",
  region: "North America",
  from: 2020,
  to: 2026,
  models: ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "iX", "XM"],
  notes:
    "BMW X-line SAV/SAC + iX/XM. Paint LAB values are HEX-derived approximations from industry touch-up references; replace with measured or licensed spectro data before production claims."
};

writeScope(join(repoRoot(), "data/oem/bmw-x-v1"), BMW_X_META, BMW_X, RECORDED_AT);

// ------------------------------------------------------------------
// Porsche (911, Cayenne, Macan, Panamera, Taycan, 718)
// ------------------------------------------------------------------
const PORSCHE: ColorSeed[] = [
  { code: "0Q0Q", marketingName: "Black", finish: "solid", hex: "#0B0B0B" },
  { code: "C9A", marketingName: "White", finish: "solid", hex: "#F2F2F0" },
  { code: "2T2T", marketingName: "Guards Red", finish: "solid", hex: "#C4161C" },
  { code: "0L0L", marketingName: "Racing Yellow", finish: "solid", hex: "#FBD006" },
  { code: "M9A", marketingName: "Jet Black Metallic", finish: "metallic", hex: "#1A1A1C" },
  { code: "C9Z", marketingName: "Carrara White Metallic", finish: "metallic", hex: "#E6E6E2" },
  { code: "M7S", marketingName: "GT Silver Metallic", finish: "metallic", hex: "#AAA9A8" },
  { code: "LM7Z", marketingName: "Agate Grey Metallic", finish: "metallic", hex: "#595A5B" },
  { code: "LM5U", marketingName: "Dolomite Silver Metallic", finish: "metallic", hex: "#A7A8A7" },
  { code: "LM5Q", marketingName: "Night Blue Metallic", finish: "metallic", hex: "#1C2A4A" },
  { code: "LC9T", marketingName: "Chalk", finish: "solid", hex: "#BDB9B0" },
  { code: "LS9R", marketingName: "Crayon", finish: "solid", hex: "#9B9690" },
  { code: "LM1Y", marketingName: "Gentian Blue Metallic", finish: "metallic", hex: "#2C4F7B" },
  { code: "LM1W", marketingName: "Miami Blue", finish: "solid", hex: "#0DB2D4" },
  { code: "LM7X", marketingName: "Python Green", finish: "solid", hex: "#5E7A2E" },
  { code: "LM3P", marketingName: "Lava Orange", finish: "solid", hex: "#E64C1D" },
  { code: "LM3Q", marketingName: "Carmine Red", finish: "pearl", hex: "#9A1522" },
  { code: "LM9A", marketingName: "Frozen Blue Metallic", finish: "metallic", hex: "#3A6B85" }
];

const PORSCHE_META: ScopeMeta = {
  scopeId: "porsche-v1",
  oem: "Porsche",
  region: "Global",
  from: 2018,
  to: 2026,
  models: ["911", "718 Cayman", "718 Boxster", "Cayenne", "Macan", "Panamera", "Taycan"],
  notes:
    "Porsche exterior colors commonly optioned across 911/718/Cayenne/Macan/Panamera/Taycan. Paint LAB values are HEX-derived approximations from industry touch-up references; replace with measured or licensed spectro data before production claims."
};

writeScope(join(repoRoot(), "data/oem/porsche-v1"), PORSCHE_META, PORSCHE, RECORDED_AT);

// ------------------------------------------------------------------
// Toyota (Camry, Corolla, RAV4, Highlander, Tacoma, Tundra, 4Runner)
// ------------------------------------------------------------------
const TOYOTA: ColorSeed[] = [
  { code: "040", marketingName: "Super White", finish: "solid", hex: "#F2F3F0" },
  { code: "070", marketingName: "Blizzard Pearl", finish: "pearl", hex: "#EDEDEA" },
  { code: "089", marketingName: "Wind Chill Pearl", finish: "pearl", hex: "#E8E8E3" },
  { code: "202", marketingName: "Black", finish: "solid", hex: "#0B0B0B" },
  { code: "218", marketingName: "Attitude Black Metallic", finish: "metallic", hex: "#1A1A1C" },
  { code: "1F7", marketingName: "Classic Silver Metallic", finish: "metallic", hex: "#B4B6B8" },
  { code: "1G3", marketingName: "Magnetic Gray Metallic", finish: "metallic", hex: "#5A5B5D" },
  { code: "1H5", marketingName: "Celestial Silver Metallic", finish: "metallic", hex: "#A7ABAE" },
  { code: "1K5", marketingName: "Underground", finish: "metallic", hex: "#49524E" },
  { code: "3T3", marketingName: "Ruby Flare Pearl", finish: "pearl", hex: "#7A1523" },
  { code: "3R3", marketingName: "Barcelona Red Metallic", finish: "metallic", hex: "#811C1F" },
  { code: "3U5", marketingName: "Supersonic Red", finish: "pearl", hex: "#B0131A" },
  { code: "4X0", marketingName: "Quicksand", finish: "solid", hex: "#A28C6C" },
  { code: "4V8", marketingName: "Cement", finish: "solid", hex: "#878783" },
  { code: "6X1", marketingName: "Army Green", finish: "solid", hex: "#4A5144" },
  { code: "6W7", marketingName: "Lunar Rock", finish: "solid", hex: "#B4B5AE" },
  { code: "8X8", marketingName: "Blueprint", finish: "metallic", hex: "#23384A" },
  { code: "8W9", marketingName: "Cavalry Blue", finish: "metallic", hex: "#324253" },
  { code: "8Y6", marketingName: "Blue Crush Metallic", finish: "metallic", hex: "#2B5C8D" },
  { code: "2QJ", marketingName: "Magnetic Gray Metallic / Midnight Black Roof", finish: "metallic", hex: "#5A5B5D" }
];

const TOYOTA_META: ScopeMeta = {
  scopeId: "toyota-v1",
  oem: "Toyota",
  region: "North America",
  from: 2019,
  to: 2026,
  models: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Prius"],
  notes:
    "Toyota exterior colors from 2019-2026 Camry/Corolla/RAV4/Highlander/Tacoma/Tundra/4Runner/Prius. Paint LAB values are HEX-derived approximations from industry touch-up references; replace with measured or licensed spectro data before production claims."
};

writeScope(join(repoRoot(), "data/oem/toyota-v1"), TOYOTA_META, TOYOTA, RECORDED_AT);
