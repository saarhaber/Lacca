import { srgbToLabD65 } from "../../src/color/rgbToLab.js";

type Finish = "solid" | "metallic" | "pearl" | "matte" | "other";

type Seed = { code: string; name: string; finish: Finish; hex: string };

const SEEDS: Seed[] = [
  { code: "GEN-WHITE",      name: "White",                finish: "solid",    hex: "#F2F2F0" },
  { code: "GEN-BLACK",      name: "Black",                finish: "solid",    hex: "#0E0E0E" },
  { code: "GEN-SILVER",     name: "Silver",               finish: "metallic", hex: "#C7C8CA" },
  { code: "GEN-GREY-LIGHT", name: "Light Grey",           finish: "metallic", hex: "#9AA0A6" },
  { code: "GEN-GREY-DARK",  name: "Dark Grey / Gunmetal", finish: "metallic", hex: "#3A3E42" },
  { code: "GEN-RED",        name: "Red",                  finish: "solid",    hex: "#B1281F" },
  { code: "GEN-BLUE-DARK",  name: "Dark Blue",            finish: "metallic", hex: "#1C3A5E" },
  { code: "GEN-BLUE-LIGHT", name: "Light Blue",           finish: "metallic", hex: "#4E6E8E" },
  { code: "GEN-GREEN-DARK", name: "Dark Green",           finish: "metallic", hex: "#2E4436" },
  { code: "GEN-BEIGE",      name: "Beige / Champagne",    finish: "metallic", hex: "#C5B79A" },
  { code: "GEN-BROWN",      name: "Brown / Bronze",       finish: "metallic", hex: "#5A3E28" },
  { code: "GEN-ORANGE",     name: "Orange",               finish: "metallic", hex: "#C65A1E" },
];

export type GenericPaint = {
  code: string;
  marketingName: string;
  finish: Finish;
  lab: {
    L: number;
    a: number;
    b: number;
    illuminant: "D65";
    observer: "2deg";
    source: "hex_derived";
    confidence: "derived";
    recordedAt: string;
    notes: string;
  };
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

const today = new Date().toISOString().slice(0, 10);

export const GENERIC_PAINTS: GenericPaint[] = SEEDS.map(({ code, name, finish, hex }) => {
  const { r, g, b } = hexToRgb(hex);
  const lab = srgbToLabD65(r, g, b);
  return {
    code,
    marketingName: name,
    finish,
    lab: {
      L: lab.L,
      a: lab.a,
      b: lab.b,
      illuminant: "D65",
      observer: "2deg",
      source: "hex_derived",
      confidence: "derived",
      recordedAt: today,
      notes: `Generic automotive color derived from ${hex}. Not factory-accurate.`,
    },
  };
});

export function isGenericPaintCode(code: string): boolean {
  return code.startsWith("GEN-");
}
