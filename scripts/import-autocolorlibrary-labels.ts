/**
 * Import JSON labels from the ACL swatch labeler into data/oem/<scopeId>/.
 *
 * Label file: JSON array of:
 *   oem, modelYear, sourcePageUrl, imageFile?, bbox{x,y,w,h}, hex, code, marketingName, finish, notes?
 *
 * Usage:
 *   tsx scripts/import-autocolorlibrary-labels.ts --in data/sources/autocolorlibrary/labels/bmw-2019-page1.json
 *   tsx scripts/import-autocolorlibrary-labels.ts --in labels.json --scope-id bmw-autocolorlibrary-v1 --dry-run
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Finish } from "../src/pipeline/seedHelpers.js";
import { writeScope, type ColorSeed, type ScopeMeta } from "../src/pipeline/seedHelpers.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

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

function scopeSlug(oem: string): string {
  return oem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultScopeId(oem: string): string {
  return `${scopeSlug(oem)}-autocolorlibrary-v1`;
}

export type AclLabelRecord = {
  oem: string;
  modelYear: number;
  sourcePageUrl: string;
  imageFile?: string;
  bbox: { x: number; y: number; w: number; h: number };
  hex: string;
  code: string;
  marketingName: string;
  finish: string;
  notes?: string;
};

const FINISHES: Finish[] = ["solid", "metallic", "pearl", "matte", "other"];

function normalizeCode(raw: string): string {
  const s = raw.trim();
  const slash = s.split("/")[0]?.trim() ?? s;
  const primary = slash.split(/\s+/)[0] ?? slash;
  return primary.toUpperCase().replace(/^#/, "");
}

function normalizeFinish(f: string): Finish {
  const x = f.trim().toLowerCase();
  if (FINISHES.includes(x as Finish)) return x as Finish;
  if (/prl|pearl/i.test(f)) return "pearl";
  if (/met|metal/i.test(f)) return "metallic";
  if (/matte/i.test(f)) return "matte";
  return "solid";
}

function labelToSeed(rec: AclLabelRecord, idx: number): ColorSeed {
  const code = normalizeCode(rec.code);
  const hex = rec.hex.startsWith("#") ? rec.hex : `#${rec.hex}`;
  const slug = scopeSlug(rec.oem);
  const img = rec.imageFile ?? "unknown-image";
  const prov = `acl:${slug}:${rec.modelYear}:${code}:${rec.bbox.x},${rec.bbox.y},${rec.bbox.w}x${rec.bbox.h}`;
  const finish = normalizeFinish(rec.finish);
  const noteParts = [
    `Auto Color Library swatch sample (${rec.sourcePageUrl}).`,
    rec.imageFile ? `Image ${rec.imageFile}; bbox ${rec.bbox.x},${rec.bbox.y} ${rec.bbox.w}×${rec.bbox.h}.` : `Bbox ${rec.bbox.x},${rec.bbox.y} ${rec.bbox.w}×${rec.bbox.h}.`,
    "Online chip; replace with spectro LAB before production claims."
  ];
  if (rec.notes) noteParts.push(rec.notes);

  return {
    code,
    marketingName: rec.marketingName.trim(),
    finish,
    hex,
    source: "autocolorlibrary_swatch",
    confidence: "derived",
    provenanceId: prov,
    note: noteParts.join(" ")
  };
}

function parseLabelsJson(raw: string): AclLabelRecord[] {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) throw new Error("Label file must be a JSON array");
  return data as AclLabelRecord[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args["in"];
  if (!inPath) {
    console.error("Usage: tsx scripts/import-autocolorlibrary-labels.ts --in <labels.json> [--scope-id ID] [--dry-run]");
    process.exit(1);
  }
  const absIn = inPath.startsWith("/") ? inPath : join(repoRoot(), inPath);
  if (!existsSync(absIn)) {
    console.error(`File not found: ${absIn}`);
    process.exit(1);
  }
  const records = parseLabelsJson(readFileSync(absIn, "utf8"));
  if (records.length === 0) {
    console.error("No labels in file");
    process.exit(1);
  }

  const oems = new Set(records.map((r) => r.oem.trim()));
  if (oems.size !== 1) {
    console.error(`Expected a single OEM in label file; found: ${[...oems].join(", ")}`);
    process.exit(1);
  }
  const oem = [...oems][0]!;
  const scopeId = args["scope-id"] ?? defaultScopeId(oem);
  const dry = args["dry-run"] === "true";

  const years = records.map((r) => r.modelYear);
  const from = Math.min(...years);
  const to = Math.max(...years);

  const byCode = new Map<string, ColorSeed>();
  for (let i = 0; i < records.length; i++) {
    const seed = labelToSeed(records[i]!, i);
    byCode.set(seed.code, seed);
  }
  const seeds = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  const meta: ScopeMeta = {
    scopeId,
    oem,
    from,
    to,
    models: [],
    notes:
      `${oem} exterior paint rows sampled from Auto Color Library chip sheets (autocolorlibrary.com) via acl-labeler. ` +
      `LAB is hex-derived from averaged swatch regions; confidence=\"derived\", source=\"autocolorlibrary_swatch\". ` +
      `Merge with PaintRef or curated scopes via merge-oem-scopes. Verify with spectro before production claims.`
  };

  if (dry) {
    console.log(JSON.stringify({ scopeId, meta, seeds }, null, 2));
    return;
  }

  const scopeDir = join(repoRoot(), "data/oem", scopeId);
  const recordedAt = new Date().toISOString().slice(0, 10);
  writeScope(scopeDir, meta, seeds, recordedAt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
