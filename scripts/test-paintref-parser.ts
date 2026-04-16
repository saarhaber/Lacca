/**
 * Offline smoke-test for the PaintRef advanced-search parser.
 *
 *   tsx scripts/test-paintref-parser.ts <fixture.html> <OEM>
 *
 * Reads a saved HTML fixture and prints parsed entries + summary so we can
 * iterate on the parser without hammering the live (rate-limiting) site.
 */

import { readFileSync } from "node:fs";
import { parseAdvancedSearchHtml } from "./lib/paintref.js";

const htmlPath = process.argv[2];
const oem = process.argv[3] ?? "Smart";
if (!htmlPath) {
  console.error("usage: tsx scripts/test-paintref-parser.ts <fixture.html> <OEM>");
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const entries = parseAdvancedSearchHtml(html, oem);

console.log(`parsed ${entries.length} entries for OEM=${oem}`);
for (const e of entries.slice(0, 10)) {
  console.log(
    `  ${e.year_from ?? "?"} | ${e.make ?? "?"} | model=${e.model ?? "-"} | name=${
      e.name ?? "-"
    } | code=${e.code ?? "-"} | hex=${e.hex ?? "-"}`
  );
}

const withHex = entries.filter((e) => e.hex).length;
const uniqueModels = new Set(entries.map((e) => e.model).filter(Boolean));
console.log(`with hex: ${withHex}/${entries.length}, unique models: ${uniqueModels.size}`);
