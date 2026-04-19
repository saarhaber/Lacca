/**
 * List paint codes in an existing exterior-paints scope whose PaintRef-style notes
 * include a model year in the embedded `years=YYYY-YYYY` range.
 *
 * Usage:
 *   tsx scripts/list-oem-paints-for-year.ts --scope bmw-paintref-v1 --year 2019
 *   tsx scripts/list-oem-paints-for-year.ts --scope bmw-paintref-v1 --year 2019 --json
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Parse years=2000-2027 from PaintRef-derived notes. */
export function parseYearRangeFromNotes(notes: string): { from: number; to: number } | null {
  const m = notes.match(/years=(\d{4})-(\d{4})/);
  if (!m) return null;
  return { from: parseInt(m[1]!, 10), to: parseInt(m[2]!, 10) };
}

export function yearOverlapsPaintRefNotes(notes: string, modelYear: number): boolean {
  const r = parseYearRangeFromNotes(notes);
  if (!r) return false;
  return modelYear >= r.from && modelYear <= r.to;
}

type ExteriorFile = {
  paints?: Array<{
    code: string;
    marketingName: string;
    lab?: { notes?: string };
  }>;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scope = args["scope"];
  const yearStr = args["year"];
  if (!scope || !yearStr) {
    console.error("Usage: tsx scripts/list-oem-paints-for-year.ts --scope <dir> --year YYYY [--json]");
    process.exit(1);
  }
  const modelYear = parseInt(yearStr, 10);
  if (Number.isNaN(modelYear)) {
    console.error("Invalid --year");
    process.exit(1);
  }

  const path = join(repoRoot(), "data/oem", scope, "exterior-paints-v1.json");
  if (!existsSync(path)) {
    console.error(`Missing ${path}`);
    process.exit(1);
  }

  const json = JSON.parse(readFileSync(path, "utf8")) as ExteriorFile;
  const paints = json.paints ?? [];
  const matched: Array<{ code: string; marketingName: string; notes?: string }> = [];
  const noYearSpan: string[] = [];

  for (const p of paints) {
    const notes = p.lab?.notes ?? "";
    if (yearOverlapsPaintRefNotes(notes, modelYear)) {
      matched.push({ code: p.code, marketingName: p.marketingName, notes });
    } else if (notes && !parseYearRangeFromNotes(notes)) {
      noYearSpan.push(p.code);
    }
  }

  if (args["json"] === "true") {
    console.log(JSON.stringify({ scope, modelYear, count: matched.length, paints: matched }, null, 2));
    return;
  }

  console.log(`Scope: ${scope} | model year: ${modelYear} | matching rows: ${matched.length}`);
  for (const p of matched.sort((a, b) => a.code.localeCompare(b.code))) {
    console.log(`${p.code}\t${p.marketingName}`);
  }
  if (noYearSpan.length && args["verbose"] === "true") {
    console.error(`\n(${noYearSpan.length} rows had no years= range in notes — omitted from filter)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
