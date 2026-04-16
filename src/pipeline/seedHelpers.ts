import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { srgbToLabD65 } from "../color/rgbToLab.js";
import type { LabMeasurement } from "../color/types.js";

export type Finish = "solid" | "metallic" | "pearl" | "matte" | "other";

export type ColorSeed = {
  code: string;
  marketingName: string;
  finish: Finish;
  /** Hex string with or without leading #, e.g. "#AABBCC" or "AABBCC" */
  hex?: string;
  /** Pre-computed LAB; takes precedence over hex when provided */
  lab?: { L: number; a: number; b: number };
  source?: string;
  confidence?: LabMeasurement["confidence"];
  provenanceId?: string;
  note?: string;
};

export type ScopeMeta = {
  scopeId: string;
  oem: string;
  region?: string;
  from: number;
  to: number;
  models: string[];
  notes: string;
  exteriorPaintFile?: string;
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Bad hex: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function round(n: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

export function buildExteriorPaintsFile(
  scopeId: string,
  seeds: ColorSeed[],
  recordedAt: string
) {
  const paints = seeds.map((s) => {
    let rawLab: { L: number; a: number; b: number };
    let source = s.source ?? "hex_derived";
    let confidence: LabMeasurement["confidence"] = s.confidence ?? "derived";
    let defaultNote: string;

    if (s.lab) {
      rawLab = s.lab;
      defaultNote = `LAB provided directly from ${source}.`;
    } else if (s.hex) {
      const [r, g, b] = hexToRgb(s.hex);
      rawLab = srgbToLabD65(r, g, b);
      defaultNote = `Derived from ${s.hex} (${source}). Replace with spectro LAB before production claims.`;
    } else {
      throw new Error(`Seed for code ${s.code} has neither hex nor lab`);
    }

    const lab: LabMeasurement = {
      L: round(rawLab.L),
      a: round(rawLab.a),
      b: round(rawLab.b),
      illuminant: "D65",
      observer: "2deg",
      source,
      confidence,
      recordedAt,
      notes: s.note ?? defaultNote,
      ...(s.provenanceId ? { provenanceId: s.provenanceId } : {})
    };

    return {
      code: s.code,
      marketingName: s.marketingName,
      finish: s.finish,
      lab
    };
  });

  return {
    $schema: "../../../schemas/exterior-paints-v1.schema.json",
    scopeId,
    version: "1.0.0",
    paints
  };
}

export function buildScopeFile(meta: ScopeMeta) {
  return {
    $schema: "../../../schemas/oem-scope-v1.schema.json",
    scopeId: meta.scopeId,
    oem: meta.oem,
    ...(meta.region ? { region: meta.region } : {}),
    modelYears: { from: meta.from, to: meta.to },
    models: meta.models,
    notes: meta.notes,
    exteriorPaintFile: meta.exteriorPaintFile ?? "./exterior-paints-v1.json"
  };
}

export function writeScope(
  scopeDir: string,
  meta: ScopeMeta,
  seeds: ColorSeed[],
  recordedAt: string
) {
  mkdirSync(scopeDir, { recursive: true });
  writeFileSync(
    join(scopeDir, "oem-scope.json"),
    JSON.stringify(buildScopeFile(meta), null, 2) + "\n"
  );
  writeFileSync(
    join(scopeDir, "exterior-paints-v1.json"),
    JSON.stringify(buildExteriorPaintsFile(meta.scopeId, seeds, recordedAt), null, 2) + "\n"
  );
  console.log(`Wrote ${seeds.length} paints → ${scopeDir}`);
}
