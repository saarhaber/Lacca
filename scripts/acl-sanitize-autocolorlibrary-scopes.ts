/**
 * Fix garbled marketingName strings in existing *-autocolorlibrary-v1 scopes
 * (OCR batch artifacts). Safe names are left unchanged.
 *
 *   npx tsx scripts/acl-sanitize-autocolorlibrary-scopes.ts [--dry-run]
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeMarketingName, isPlausibleMarketingName } from "./lib/acl-marketing-name.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]!.startsWith("--")) {
      const key = argv[i]!.slice(2);
      const val = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : "true";
      out[key] = val;
    }
  }
  return out;
}

type Finish = "solid" | "metallic" | "pearl" | "matte" | "other";

type ExteriorFile = {
  paints: Array<{ code: string; marketingName: string; finish?: Finish }>;
};

function finishFromName(name: string): Finish {
  const n = name.toLowerCase();
  if (/\bmatte\b|\bmatt\b|magno/i.test(n)) return "matte";
  if (/\bprl\b|\bpearl\b|\bpri\b|\b3ct\b/i.test(n)) return "pearl";
  if (/\bmet\b|\bmetal/i.test(n)) return "metallic";
  return "solid";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dry = args["dry-run"] === "true";
  const root = join(repoRoot(), "data/oem");
  let scopes = 0;
  let rows = 0;

  for (const dir of readdirSync(root)) {
    if (!dir.endsWith("-autocolorlibrary-v1")) continue;
    const path = join(root, dir, "exterior-paints-v1.json");
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, "utf8")) as ExteriorFile;
    if (!data.paints?.length) continue;
    let changed = false;
    for (const p of data.paints) {
      const code = p.code?.trim() ?? "";
      const prev = p.marketingName ?? "";
      if (isPlausibleMarketingName(prev)) continue;
      const next = finalizeMarketingName(code, prev);
      if (next !== prev) {
        p.marketingName = next;
        p.finish = finishFromName(next);
        changed = true;
        rows++;
      }
    }
    if (changed && !dry) {
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    }
    if (changed) scopes++;
  }

  console.log(
    dry
      ? `[dry-run] Would update ${rows} paints in ${scopes} scopes`
      : `Updated ${rows} paints in ${scopes} *-autocolorlibrary-v1 scopes`
  );
}

main();
