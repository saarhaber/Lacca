/**
 * Download an Auto Color Library year/make page and its linked Shopify chip-sheet JPEGs.
 *
 * Usage:
 *   tsx scripts/fetch-autocolorlibrary-page.ts --url https://www.autocolorlibrary.com/pages/2019-BMW.html
 *   tsx scripts/fetch-autocolorlibrary-page.ts --year 2019 --make BMW
 *   tsx scripts/fetch-autocolorlibrary-page.ts --year 2019 --make BMW --only-index 0
 */

import { join } from "node:path";
import { harvestAutocolorlibraryPage } from "./lib/autocolorlibraryHarvest.js";

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

/** URL path segment for make, e.g. BMW -> BMW, Alfa Romeo -> Alfa-Romeo (site convention). */
function makeUrlSegment(make: string): string {
  return make
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join("-");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const throttleMs = Math.max(0, parseInt(args["throttle-ms"] ?? "800", 10));
  const onlyIndex =
    args["only-index"] !== undefined ? parseInt(args["only-index"]!, 10) : null;

  let pageUrl = args["url"] ?? "";
  if (!pageUrl) {
    const year = args["year"];
    const make = args["make"];
    if (!year || !make) {
      console.error(
        "Usage: tsx scripts/fetch-autocolorlibrary-page.ts --url <page> | --year YYYY --make Make [--only-index N] [--throttle-ms 800]"
      );
      process.exit(1);
    }
    const seg = makeUrlSegment(make);
    pageUrl = `https://www.autocolorlibrary.com/pages/${year}-${seg}.html`;
  }

  console.log(`GET ${pageUrl}`);
  const res = await harvestAutocolorlibraryPage({
    pageUrl,
    throttleMs,
    force: args["force"] === "true",
    onlyIndex,
    continueOnPageError: false
  });
  if (!res.ok) {
    console.error(res.error);
    process.exit(1);
  }
  console.log(`Manifest → ${join(res.outDir, "manifest.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
