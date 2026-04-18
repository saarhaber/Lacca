/**
 * Merge OPI.com sitemap + product pages into the local catalog JSON.
 *
 * Each qualifying product page exposes Shopify metafields in __NEXT_DATA__
 * (hex_code, sku, finish, color_collection) — more reliable than guessing
 * /products/nail-lacquer-{slug} URLs.
 *
 * Usage:
 *   npx tsx scripts/sync-opi-from-opicom.ts
 *   npx tsx scripts/sync-opi-from-opicom.ts --dry-run --max 30
 *
 * Respect OPI robots.txt (Allow: /) and keep request volume reasonable.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogPointer } from "../src/pipeline/opiTypes.js";
import { srgbToLabD65 } from "../src/color/rgbToLab.js";
import type { OpiCatalogFile, OpiSku, PaintFinish } from "../src/pipeline/opiTypes.js";
import { assertValidOpiCatalog } from "../src/pipeline/validateData.js";
import {
  fetchOpiProductPage,
  fetchOpiSitemapProductUrls,
  handleFromProductUrl,
  urlPreferenceRank,
  type ScrapedOpiProduct
} from "./lib/opiSite.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): { dryRun: boolean; max: number | null; delayMs: number; outVersion: string | null } {
  let dryRun = false;
  let max: number | null = null;
  let delayMs = 120;
  let outVersion: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--max" && argv[i + 1]) {
      max = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (argv[i] === "--delay-ms" && argv[i + 1]) {
      delayMs = Math.max(0, parseInt(argv[++i], 10) || 0);
    } else if (argv[i] === "--out-version" && argv[i + 1]) {
      outVersion = argv[++i] ?? null;
    }
  }
  return { dryRun, max, delayMs, outVersion };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Bad hex: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function round(n: number, digits = 2): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

const RECORDED_AT = new Date().toISOString().slice(0, 10);

function labFromHex(hex: string, notes: string) {
  const [r, g, b] = hexToRgb(hex);
  const lab = srgbToLabD65(r, g, b);
  return {
    L: round(lab.L),
    a: round(lab.a),
    b: round(lab.b),
    illuminant: "D65" as const,
    observer: "2deg" as const,
    source: "opi_shopify_hex_metafield",
    confidence: "derived" as const,
    recordedAt: RECORDED_AT,
    notes
  };
}

function pickBetterUrl(current: string | undefined, candidate: string, candHandle: string): string {
  if (!current) return candidate;
  const curHandle = handleFromProductUrl(current);
  if (!curHandle) return candidate;
  const r1 = urlPreferenceRank(curHandle);
  const r2 = urlPreferenceRank(candHandle);
  if (r2 < r1) return candidate;
  return current;
}

function mergeScrapedBySku(rows: ScrapedOpiProduct[]): Map<string, ScrapedOpiProduct> {
  const map = new Map<string, ScrapedOpiProduct>();
  for (const row of rows) {
    const prev = map.get(row.sku);
    if (!prev) {
      map.set(row.sku, row);
      continue;
    }
    const r1 = urlPreferenceRank(prev.handle);
    const r2 = urlPreferenceRank(row.handle);
    if (r2 < r1) map.set(row.sku, row);
    else if (r2 === r1 && row.productUrl.length < prev.productUrl.length) map.set(row.sku, row);
  }
  return map;
}

function loadBaseCatalog(path: string): OpiCatalogFile {
  const raw = JSON.parse(readFileSync(path, "utf8")) as OpiCatalogFile & { $schema?: string };
  delete raw.$schema;
  return raw;
}

function toSku(
  scraped: ScrapedOpiProduct,
  existing?: OpiSku
): OpiSku {
  const notes =
    "LAB from OPI.com Shopify hex_code metafield (brand marketing reference). Replace with spectro bottle-chip LAB before production claims.";
  const lab = labFromHex(scraped.hex, notes);
  const finish: PaintFinish | undefined = scraped.finish ?? existing?.finish;
  const out: OpiSku = {
    sku: scraped.sku,
    name: scraped.title,
    lab,
    ...(scraped.collection ? { collection: scraped.collection } : existing?.collection ? { collection: existing.collection } : {}),
    ...(finish ? { finish } : {}),
    productUrl: scraped.productUrl
  };
  return out;
}

function nextPatchVersion(v: string): string {
  const parts = v.split(".").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) throw new Error(`Bad semver: ${v}`);
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

async function main() {
  const { dryRun, max, delayMs, outVersion: outVersionArg } = parseArgs(process.argv.slice(2));
  const root = repoRoot();
  const pointerPath = join(root, "data/pipeline/catalog-pointer.json");
  const pointer = JSON.parse(readFileSync(pointerPath, "utf8")) as CatalogPointer;
  const basePath = join(root, pointer.activeCatalogPath);
  const base = loadBaseCatalog(basePath);
  console.log(`Merge base: ${pointer.activeCatalogPath} (${base.skus.length} SKUs)`);

  console.log("Fetching OPI sitemap…");
  const urls = await fetchOpiSitemapProductUrls();
  const limited = max ? urls.slice(0, max) : urls;
  console.log(`Scraping ${limited.length} product pages (${urls.length} color URLs in sitemap)…`);

  const scraped: ScrapedOpiProduct[] = [];
  for (let i = 0; i < limited.length; i++) {
    const u = limited[i];
    const row = await fetchOpiProductPage(u);
    if (row) scraped.push(row);
    if ((i + 1) % 50 === 0) console.log(`  …${i + 1}/${limited.length}`);
    if (delayMs && i < limited.length - 1) await sleep(delayMs);
  }

  const bySku = mergeScrapedBySku(scraped);
  console.log(`Parsed ${scraped.length} pages with hex+sku; ${bySku.size} unique SKUs.`);

  const baseMap = new Map(base.skus.map((s) => [s.sku.toUpperCase(), s]));

  for (const [sku, row] of bySku) {
    const ex = baseMap.get(sku);
    if (ex) {
      const productUrl = pickBetterUrl(ex.productUrl, row.productUrl, row.handle);
      const merged = toSku(row, ex);
      merged.productUrl = productUrl;
      if (ex.collection && !merged.collection) merged.collection = ex.collection;
      if (ex.finish && !merged.finish) merged.finish = ex.finish;
      baseMap.set(sku, merged);
    } else {
      baseMap.set(sku, toSku(row));
    }
  }

  const skus = [...baseMap.values()].sort((a, b) => a.sku.localeCompare(b.sku));

  const catalogVersion = outVersionArg ?? nextPatchVersion(pointer.catalogVersion);
  const catalog: OpiCatalogFile = {
    catalogVersion,
    generatedAt: new Date().toISOString(),
    illuminant: "D65",
    observer: "2deg",
    deltaEVersion: base.deltaEVersion,
    skus
  };

  assertValidOpiCatalog(catalog);

  if (dryRun) {
    const withUrl = skus.filter((s) => s.productUrl).length;
    console.log(`Dry run: would write ${skus.length} SKUs (${withUrl} with productUrl).`);
    return;
  }

  const outDir = join(root, "data/opi");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `catalog-${catalogVersion}.json`);
  const fileBody = { $schema: "../../schemas/opi-catalog-v1.schema.json", ...catalog };
  writeFileSync(outPath, `${JSON.stringify(fileBody, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
