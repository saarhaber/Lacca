import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { srgbToLabD65 } from "../src/color/rgbToLab.js";

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

type Finish = "solid" | "metallic" | "pearl" | "matte" | "other";
type Seed = { code: string; marketingName: string; finish: Finish; hex: string; note?: string };
type ScopeMeta = {
  scopeId: string;
  oem: string;
  region: string;
  from: number;
  to: number;
  models: string[];
  notes: string;
};

const RECORDED_AT = "2026-04-16";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Bad hex: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function round(n: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

function buildExteriorPaintsFile(scopeId: string, seeds: Seed[]) {
  const paints = seeds.map((s) => {
    const [r, g, b] = hexToRgb(s.hex);
    const lab = srgbToLabD65(r, g, b);
    return {
      code: s.code,
      marketingName: s.marketingName,
      finish: s.finish,
      lab: {
        L: round(lab.L),
        a: round(lab.a),
        b: round(lab.b),
        illuminant: "D65" as const,
        observer: "2deg" as const,
        source: "hex_derived",
        confidence: "derived" as const,
        recordedAt: RECORDED_AT,
        notes:
          s.note ??
          `Derived from ${s.hex} (industry touch-up reference). Replace with spectro LAB before production claims.`
      }
    };
  });

  return {
    $schema: "../../../schemas/exterior-paints-v1.schema.json",
    scopeId,
    version: "1.0.0",
    paints
  };
}

function buildScopeFile(meta: ScopeMeta) {
  return {
    $schema: "../../../schemas/oem-scope-v1.schema.json",
    scopeId: meta.scopeId,
    oem: meta.oem,
    region: meta.region,
    modelYears: { from: meta.from, to: meta.to },
    models: meta.models,
    notes: meta.notes,
    exteriorPaintFile: "./exterior-paints-v1.json"
  };
}

function writeScope(scopeDir: string, meta: ScopeMeta, seeds: Seed[]) {
  mkdirSync(scopeDir, { recursive: true });
  writeFileSync(
    join(scopeDir, "oem-scope.json"),
    JSON.stringify(buildScopeFile(meta), null, 2) + "\n"
  );
  writeFileSync(
    join(scopeDir, "exterior-paints-v1.json"),
    JSON.stringify(buildExteriorPaintsFile(meta.scopeId, seeds), null, 2) + "\n"
  );
  console.log(`Wrote ${seeds.length} paints → ${scopeDir}`);
}

// ------------------------------------------------------------------
// BMW X-line (X1, X2, X3, X4, X5, X6, X7, iX, XM)
// ------------------------------------------------------------------
const BMW_X: Seed[] = [
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

writeScope(
  join(repoRoot(), "data/oem/bmw-x-v1"),
  {
    scopeId: "bmw-x-v1",
    oem: "BMW",
    region: "North America",
    from: 2020,
    to: 2026,
    models: ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "iX", "XM"],
    notes:
      "BMW X-line SAV/SAC + iX/XM. Paint LAB values are HEX-derived approximations from industry touch-up references; replace with measured or licensed spectro data before production claims."
  },
  BMW_X
);

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..");
}
