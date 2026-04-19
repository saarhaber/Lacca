/**
 * Harvest every year/make color-book page listed in Auto Color Library's
 * storefront scripts.js (var attribute = { year: [makes...], ... }).
 *
 * Discovers URLs of the form https://www.autocolorlibrary.com/pages/{year}-{Make}.html
 * (same convention as the site's select handler).
 *
 * Usage:
 *   tsx scripts/crawl-autocolorlibrary-site.ts --dry-run
 *   tsx scripts/crawl-autocolorlibrary-site.ts --limit 20
 *   tsx scripts/crawl-autocolorlibrary-site.ts --throttle-ms 1200
 *   tsx scripts/crawl-autocolorlibrary-site.ts --force
 *   tsx scripts/crawl-autocolorlibrary-site.ts --retry-failed
 *     (re-harvest only pages whose manifest.json contains "error")
 *
 * Caches scripts.js under data/sources/autocolorlibrary/cache/scripts.js
 * Writes data/sources/autocolorlibrary/site-index.json when the crawl finishes.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchBytesWithRetry,
  harvestAutocolorlibraryPage,
  makeSlug,
  repoRoot
} from "./lib/autocolorlibraryHarvest.js";

const SCRIPTS_JS =
  "https://www.autocolorlibrary.com/cdn/shop/t/5/assets/scripts.js?v=48074346221110806341744735956";
const BASE = "https://www.autocolorlibrary.com";

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

function extractAttributeObject(js: string): Record<string | number, string[]> {
  const marker = "var attribute=";
  const i = js.indexOf(marker);
  if (i < 0) throw new Error("scripts.js: missing var attribute=");
  const brace = js.indexOf("{", i);
  if (brace < 0) throw new Error("scripts.js: missing attribute object");
  let depth = 0;
  let end = -1;
  for (let j = brace; j < js.length; j++) {
    const c = js[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("scripts.js: unclosed attribute object");
  const literal = js.slice(brace, end);
  return new Function(`return ${literal}`)() as Record<string | number, string[]>;
}

function yearKeyToNumber(k: string | number): number {
  if (typeof k === "number") return k;
  const n = parseInt(String(k), 10);
  if (!Number.isNaN(n)) return n;
  return 0;
}

function isPlaceholderMake(m: string): boolean {
  const s = m.trim().toLowerCase().replace(/\u00a0/g, " ");
  return s === "" || s.startsWith("choose make") || s === "choose make";
}

function pageUrlFor(year: number, make: string): string {
  return `${BASE}/pages/${year}-${make}.html`;
}

type Pair = { year: number; make: string; url: string };

function writeSiteIndex(): void {
  const pagesRoot = join(repoRoot(), "data/sources/autocolorlibrary/pages");
  if (!existsSync(pagesRoot)) return;
  const entries: Array<{
    dir: string;
    pageUrl: string;
    imageCount: number;
    totalBytes: number;
    error: string | null;
  }> = [];
  for (const ent of readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const mpath = join(pagesRoot, ent.name, "manifest.json");
    if (!existsSync(mpath)) continue;
    const m = JSON.parse(readFileSync(mpath, "utf8")) as {
      pageUrl?: string;
      error?: string;
      images?: Array<{ bytes?: number }>;
    };
    const imgs = m.images ?? [];
    const imageCount = imgs.filter((i) => (i.bytes ?? 0) > 0).length;
    const totalBytes = imgs.reduce((s, i) => s + (i.bytes ?? 0), 0);
    entries.push({
      dir: ent.name,
      pageUrl: m.pageUrl ?? "",
      imageCount,
      totalBytes,
      error: m.error ?? null
    });
  }
  entries.sort((a, b) => a.dir.localeCompare(b.dir));
  const withErr = entries.filter((e) => e.error).length;
  const idx = {
    generatedAt: new Date().toISOString(),
    totalManifests: entries.length,
    withPageError: withErr,
    entries
  };
  writeFileSync(
    join(repoRoot(), "data/sources/autocolorlibrary/site-index.json"),
    JSON.stringify(idx, null, 2) + "\n"
  );
  console.log(
    `Wrote site-index.json (${entries.length} manifests, ${withErr} with page fetch error)`
  );
}

function loadFailedPairsFromManifests(): Pair[] {
  const pagesRoot = join(repoRoot(), "data/sources/autocolorlibrary/pages");
  if (!existsSync(pagesRoot)) return [];
  const out: Pair[] = [];
  for (const ent of readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const mpath = join(pagesRoot, ent.name, "manifest.json");
    if (!existsSync(mpath)) continue;
    const m = JSON.parse(readFileSync(mpath, "utf8")) as {
      pageUrl?: string;
      error?: string;
    };
    if (!m.error || !m.pageUrl) continue;
    const u = m.pageUrl.match(/(\d{4})-([^/]+)\.html/i);
    if (!u) continue;
    const year = parseInt(u[1]!, 10);
    const make = u[2]!;
    out.push({ year, make, url: m.pageUrl });
  }
  out.sort((a, b) => a.year - b.year || a.make.localeCompare(b.make));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const throttleMs = Math.max(0, parseInt(args["throttle-ms"] ?? "900", 10));
  const dry = args["dry-run"] === "true";
  const force = args["force"] === "true";
  const limit = args["limit"] ? parseInt(args["limit"], 10) : null;
  const skipCached = args["skip-cached"] !== "false";
  const retryFailed = args["retry-failed"] === "true";

  let pairs: Pair[] = [];
  if (retryFailed) {
    pairs = loadFailedPairsFromManifests();
    console.log(`Retry mode: ${pairs.length} failed manifests to re-harvest`);
    if (pairs.length === 0) {
      writeSiteIndex();
      return;
    }
  } else {
    const cacheDir = join(repoRoot(), "data/sources/autocolorlibrary/cache");
    const cachePath = join(cacheDir, "scripts.js");
    let js: string;
    if (existsSync(cachePath) && args["refresh-scripts"] !== "true") {
      js = readFileSync(cachePath, "utf8");
      console.log(`Using cached ${cachePath}`);
    } else {
      const r = await fetchBytesWithRetry(SCRIPTS_JS, throttleMs);
      if (!r.ok) throw new Error(`Failed to download scripts.js: HTTP ${r.status}`);
      js = r.body.toString("utf8");
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cachePath, js);
      console.log(`Wrote ${cachePath} (${js.length} bytes)`);
    }

    const attr = extractAttributeObject(js);
    for (const [key, makes] of Object.entries(attr)) {
      const year = yearKeyToNumber(key);
      if (year < 1800 || year > 2100) continue;
      if (!Array.isArray(makes)) continue;
      for (const m of makes) {
        if (typeof m !== "string" || isPlaceholderMake(m)) continue;
        pairs.push({ year, make: m, url: pageUrlFor(year, m) });
      }
    }
    pairs.sort((a, b) => a.year - b.year || a.make.localeCompare(b.make));
  }

  console.log(`${retryFailed ? "Retry queue" : "Catalog"}: ${pairs.length} year/make URLs`);
  if (dry) {
    for (const p of pairs.slice(0, 15)) console.log(p.url);
    if (pairs.length > 15) console.log(`… +${pairs.length - 15} more`);
    return;
  }

  let done = 0;
  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i]!;
    if (limit !== null && done >= limit) break;
    const makeFromUrl = p.make.replace(/-/g, " ");
    const dirSlug = `${p.year}-${makeSlug(makeFromUrl)}`;
    const manifestPath = join(
      repoRoot(),
      "data/sources/autocolorlibrary/pages",
      dirSlug,
      "manifest.json"
    );
    let manifestOk = false;
    if (existsSync(manifestPath)) {
      try {
        const mj = JSON.parse(readFileSync(manifestPath, "utf8")) as { error?: string };
        manifestOk = !mj.error;
      } catch {
        manifestOk = false;
      }
    }
    if (skipCached && manifestOk && !force) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${pairs.length}] ${p.url} … `);
    try {
      const res = await harvestAutocolorlibraryPage({
        pageUrl: p.url,
        throttleMs,
        force,
        onlyIndex: null,
        continueOnPageError: true
      });
      if (res.ok) {
        console.log("ok");
        ok++;
      } else {
        console.log(`fail ${res.error}`);
        fail++;
      }
    } catch (e) {
      console.log(`error ${e instanceof Error ? e.message : e}`);
      fail++;
    }
    done++;
  }

  console.log(
    `\nDone: ok=${ok} fail=${fail} skipped=${skipped} processed=${done} (throttle ${throttleMs}ms)`
  );
  writeSiteIndex();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
