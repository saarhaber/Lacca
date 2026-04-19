/**
 * Download an Auto Color Library year/make page and its linked Shopify chip-sheet JPEGs.
 *
 * Pages are mostly image-based; HTML carries img src URLs on cdn.shopify.com.
 *
 * Usage:
 *   tsx scripts/fetch-autocolorlibrary-page.ts --url https://www.autocolorlibrary.com/pages/2019-BMW.html
 *   tsx scripts/fetch-autocolorlibrary-page.ts --year 2019 --make BMW
 *   tsx scripts/fetch-autocolorlibrary-page.ts --year 2019 --make BMW --only-index 0
 *     (download first chip image only — useful for pilots)
 *
 * Output: data/sources/autocolorlibrary/pages/<year>-<make-slug>/manifest.json (+ html, images)
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/httpDispatcher.js";

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

function makeSlug(make: string): string {
  return make
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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

function normalizeImageUrl(raw: string): string | null {
  let u = raw.trim();
  if (u.startsWith("//")) u = "https:" + u;
  if (!u.startsWith("http")) return null;
  if (!/cdn\.shopify\.com/i.test(u)) return null;
  if (!/\.(jpe?g|png|gif|webp)(\?|$)/i.test(u)) return null;
  return u;
}

function extractShopifyImageUrls(html: string): string[] {
  const found = new Set<string>();
  const re = /(?:src|href)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = normalizeImageUrl(m[1]);
    if (n) found.add(n);
  }
  return [...found].sort();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchBytes(
  url: string,
  throttleMs: number
): Promise<{ ok: boolean; status: number; body: Buffer }> {
  await sleep(throttleMs);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: {
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0 (compatible; lacca-autocolorlibrary-harvest/1.0)"
    }
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, body: buf };
}

function shortHash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
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

  const yearMatch = pageUrl.match(/(\d{4})-[^/]+\.html/i);
  const yearStr = yearMatch ? yearMatch[1] : "unknown-year";
  const makeMatch = pageUrl.match(/\d{4}-([^/.]+)\.html/i);
  const makeFromUrl = makeMatch ? makeMatch[1].replace(/-/g, " ") : "unknown-make";
  const dirSlug = `${yearStr}-${makeSlug(makeFromUrl)}`;
  const outDir = join(repoRoot(), "data/sources/autocolorlibrary/pages", dirSlug);
  mkdirSync(outDir, { recursive: true });

  const htmlPath = join(outDir, "page.html");
  let html: string;
  if (existsSync(htmlPath) && args["force"] !== "true") {
    html = readFileSync(htmlPath, "utf8");
    console.log(`Reusing cached HTML → ${htmlPath}`);
  } else {
    console.log(`GET ${pageUrl}`);
    const pageRes = await fetchBytes(pageUrl, throttleMs);
    if (!pageRes.ok) {
      console.error(`Page fetch failed: HTTP ${pageRes.status}`);
      process.exit(1);
    }
    html = pageRes.body.toString("utf8");
    writeFileSync(htmlPath, html);
  }

  let imageUrls = extractShopifyImageUrls(html);
  // Prefer chip filenames like 2019_BMW_01.jpg (exclude tiny icons/logos if mixed in)
  const chipLike = imageUrls.filter(
    (u) => /_\d{2}\.(jpe?g|png)/i.test(u) || /\/files\/\d{4}_/i.test(u)
  );
  if (chipLike.length > 0) imageUrls = chipLike;

  if (onlyIndex !== null && !Number.isNaN(onlyIndex)) {
    if (onlyIndex < 0 || onlyIndex >= imageUrls.length) {
      console.error(`--only-index ${onlyIndex} out of range (0..${imageUrls.length - 1})`);
      process.exit(1);
    }
    imageUrls = [imageUrls[onlyIndex]!];
  }

  const images: Array<{
    url: string;
    localRelative: string;
    status: number;
    bytes: number;
    sha1: string;
  }> = [];

  for (const url of imageUrls) {
    const pathPart = url.replace(/^https?:\/\//i, "").split("/").pop() ?? "";
    const tailNoQuery = pathPart.split("?")[0] || `img-${shortHash(url)}.jpg`;
    const safeName = tailNoQuery.replace(/[^a-zA-Z0-9._-]/g, "_");
    const localPath = join(outDir, safeName);

    let body: Buffer;
    let status: number;
    if (existsSync(localPath) && args["force"] !== "true") {
      body = readFileSync(localPath);
      status = 200;
      console.log(`Reuse image ${safeName}`);
    } else {
      const r = await fetchBytes(url, throttleMs);
      status = r.status;
      if (!r.ok) {
        console.warn(`SKIP ${url} HTTP ${r.status}`);
        images.push({
          url,
          localRelative: safeName,
          status: r.status,
          bytes: 0,
          sha1: ""
        });
        continue;
      }
      body = r.body;
      writeFileSync(localPath, body);
      console.log(`Wrote ${safeName} (${body.length} bytes)`);
    }
    const sha1 = createHash("sha1").update(body).digest("hex");
    images.push({
      url,
      localRelative: safeName,
      status,
      bytes: body.length,
      sha1
    });
  }

  const manifest = {
    pageUrl,
    fetchedAt: new Date().toISOString(),
    pageDir: `data/sources/autocolorlibrary/pages/${dirSlug}`,
    htmlRelative: "page.html",
    images
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Manifest → ${join(outDir, "manifest.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
