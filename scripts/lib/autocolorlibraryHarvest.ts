/**
 * Shared harvest logic for Auto Color Library year/make pages (HTML + Shopify chip JPEGs).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "./httpDispatcher.js";

export function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function makeSlug(make: string): string {
  return make
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeImageUrl(raw: string): string | null {
  let u = raw.trim();
  if (u.startsWith("//")) u = "https:" + u;
  if (!u.startsWith("http")) return null;
  if (!/cdn\.shopify\.com/i.test(u)) return null;
  if (!/\.(jpe?g|png|gif|webp)(\?|$)/i.test(u)) return null;
  return u;
}

export function extractShopifyImageUrls(html: string): string[] {
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

export async function fetchBytes(
  url: string,
  throttleMs: number
): Promise<{ ok: boolean; status: number; body: Buffer }> {
  await sleep(throttleMs);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(90_000),
      headers: {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; lacca-autocolorlibrary-harvest/1.0; respectful bulk mirror)"
      }
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, body: buf };
  } catch {
    return { ok: false, status: 0, body: Buffer.alloc(0) };
  }
}

/** Retries transient failures (network, 5xx, 429) — not 404. */
export async function fetchBytesWithRetry(
  url: string,
  throttleMs: number,
  maxAttempts = 5
): Promise<{ ok: boolean; status: number; body: Buffer }> {
  let last = { ok: false, status: 0, body: Buffer.alloc(0) };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await fetchBytes(url, throttleMs);
    if (last.ok) return last;
    if (last.status === 404) return last;
    const retryable =
      last.status === 0 ||
      last.status === 408 ||
      last.status === 429 ||
      last.status >= 500;
    if (!retryable || attempt === maxAttempts) return last;
    const backoff = Math.min(45_000, throttleMs * 2 ** attempt);
    await sleep(backoff);
  }
  return last;
}

function shortHash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

export type HarvestOptions = {
  pageUrl: string;
  throttleMs: number;
  force: boolean;
  onlyIndex: number | null;
  /** If true, failed page fetch writes manifest and returns instead of throwing */
  continueOnPageError: boolean;
};

export type HarvestResult = {
  ok: boolean;
  pageUrl: string;
  dirSlug: string;
  outDir: string;
  httpStatus?: number;
  error?: string;
};

export async function harvestAutocolorlibraryPage(opts: HarvestOptions): Promise<HarvestResult> {
  const { pageUrl, throttleMs, force, onlyIndex, continueOnPageError } = opts;

  const yearMatch = pageUrl.match(/(\d{4})-[^/]+\.html/i);
  const yearStr = yearMatch ? yearMatch[1] : "unknown-year";
  const makeMatch = pageUrl.match(/\d{4}-([^/.]+)\.html/i);
  const makeFromUrl = makeMatch ? makeMatch[1].replace(/-/g, " ") : "unknown-make";
  const dirSlug = `${yearStr}-${makeSlug(makeFromUrl)}`;
  const outDir = join(repoRoot(), "data/sources/autocolorlibrary/pages", dirSlug);
  mkdirSync(outDir, { recursive: true });

  const htmlPath = join(outDir, "page.html");
  let html: string;
  if (existsSync(htmlPath) && !force) {
    html = readFileSync(htmlPath, "utf8");
  } else {
    const pageRes = await fetchBytesWithRetry(pageUrl, throttleMs);
    if (!pageRes.ok) {
      const err = `HTTP ${pageRes.status}`;
      if (continueOnPageError) {
        const manifest = {
          pageUrl,
          fetchedAt: new Date().toISOString(),
          pageDir: `data/sources/autocolorlibrary/pages/${dirSlug}`,
          htmlRelative: "page.html",
          error: err,
          images: [] as unknown[]
        };
        writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
        return { ok: false, pageUrl, dirSlug, outDir, httpStatus: pageRes.status, error: err };
      }
      throw new Error(`Page fetch failed: ${err}`);
    }
    html = pageRes.body.toString("utf8");
    writeFileSync(htmlPath, html);
  }

  let imageUrls = extractShopifyImageUrls(html);
  const chipLike = imageUrls.filter(
    (u) => /_\d{2}\.(jpe?g|png)/i.test(u) || /\/files\/\d{4}_/i.test(u)
  );
  if (chipLike.length > 0) imageUrls = chipLike;

  if (onlyIndex !== null && !Number.isNaN(onlyIndex)) {
    if (onlyIndex < 0 || onlyIndex >= imageUrls.length) {
      throw new Error(`onlyIndex ${onlyIndex} out of range (0..${imageUrls.length - 1})`);
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
    if (existsSync(localPath) && !force) {
      body = readFileSync(localPath);
      status = 200;
    } else {
      const r = await fetchBytesWithRetry(url, throttleMs);
      status = r.status;
      if (!r.ok) {
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
  return { ok: true, pageUrl, dirSlug, outDir };
}
