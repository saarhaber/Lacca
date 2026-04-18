import type { PaintFinish } from "../../src/pipeline/opiTypes.js";

const SITEMAP_URL = "https://www.opi.com/sitemap.xml";
const PRODUCT_HOST = "https://www.opi.com";

/** US storefront paths only (no /de-DE/ etc.). */
const US_PRODUCT_LOC = /<loc>(https:\/\/www\.opi\.com\/products\/[^<]+)<\/loc>/g;

const SKIP_HANDLE_PREFIXES = [
  "displays-kits-",
  "dipping-powder-",
  "on-point-",
  "xpresson-",
  "top-base-coat",
  "gelevate-",
  "gift-sets-",
  "gifts-",
  "chrome-powders-",
  "liquid-perfection-"
];

const COLOR_HANDLE_PREFIXES = [
  "nail-lacquer-",
  "infinite-shine-",
  "gel-nail-polish-",
  "nature-strong-vegan-nail-lacquer-",
  "natural-origin-nail-lacquer-",
  "quick-dry-nail-polish-"
];

export type ScrapedOpiProduct = {
  handle: string;
  productUrl: string;
  title: string;
  productType: string;
  sku: string;
  hex: string;
  collection?: string;
  finishRaw?: string;
  finish?: PaintFinish;
};

export function handleFromProductUrl(url: string): string | null {
  const m = url.match(/\/products\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function shouldScrapeHandle(handle: string): boolean {
  if (!handle) return false;
  if (SKIP_HANDLE_PREFIXES.some((p) => handle.startsWith(p))) return false;
  return COLOR_HANDLE_PREFIXES.some((p) => handle.startsWith(p));
}

export function urlPreferenceRank(handle: string): number {
  if (handle.startsWith("nail-lacquer-")) return 0;
  if (handle.startsWith("infinite-shine-")) return 1;
  if (handle.startsWith("natural-origin-nail-lacquer-")) return 2;
  if (handle.startsWith("nature-strong-vegan-nail-lacquer-")) return 3;
  if (handle.startsWith("quick-dry-nail-polish-")) return 4;
  if (handle.startsWith("gel-nail-polish-")) return 5;
  return 10;
}

export async function fetchOpiSitemapProductUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, {
    headers: { "user-agent": "LaccaOpenDataBot/1.0 (+https://github.com/)", accept: "application/xml,text/xml" }
  });
  if (!res.ok) throw new Error(`OPI sitemap ${res.status}`);
  const xml = await res.text();
  const urls: string[] = [];
  for (const m of xml.matchAll(US_PRODUCT_LOC)) {
    urls.push(m[1]);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const h = handleFromProductUrl(u);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    if (shouldScrapeHandle(h)) out.push(u);
  }
  return out;
}

function mapFinish(raw: string | undefined): PaintFinish | undefined {
  if (!raw) return undefined;
  const x = raw.toLowerCase();
  if (x.includes("crème") || x.includes("creme") || x.includes("cream")) return "solid";
  if (x.includes("pearl") || x.includes("shimmer")) return "pearl";
  if (x.includes("metal") || x.includes("chrome")) return "metallic";
  if (x.includes("matte")) return "matte";
  return "other";
}

type NextProduct = {
  title?: string;
  handle?: string;
  productType?: string;
  meta_hex_color?: { value?: string };
  meta_sku?: { value?: string };
  meta_color_collection?: { value?: string };
  meta_finish?: { value?: string };
};

function extractProductFromNextData(html: string): NextProduct | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let j: unknown;
  try {
    j = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const queries = (j as { props?: { pageProps?: { dehydratedState?: { queries?: unknown[] } } } })?.props
    ?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return null;
  for (const q of queries) {
    const key = (q as { queryKey?: unknown }).queryKey;
    if (!Array.isArray(key) || key[0] !== "getProduct") continue;
    const product = (q as { state?: { data?: { product?: NextProduct } } })?.state?.data?.product;
    if (product?.handle) return product;
  }
  return null;
}

export async function fetchOpiProductPage(productUrl: string): Promise<ScrapedOpiProduct | null> {
  const res = await fetch(productUrl, {
    headers: {
      "user-agent": "LaccaOpenDataBot/1.0 (color-indexing; contact: repo maintainer)",
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) return null;
  const html = await res.text();
  const p = extractProductFromNextData(html);
  if (!p?.handle) return null;
  const hexRaw = p.meta_hex_color?.value?.trim();
  const skuRaw = p.meta_sku?.value?.trim();
  if (!hexRaw || !skuRaw) return null;
  const hex = hexRaw.startsWith("#") ? hexRaw : `#${hexRaw}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const finishRaw = p.meta_finish?.value?.trim();
  return {
    handle: p.handle,
    productUrl: `${PRODUCT_HOST}/products/${p.handle}`,
    title: (p.title ?? p.handle).trim(),
    productType: (p.productType ?? "").trim(),
    sku: skuRaw.toUpperCase(),
    hex,
    collection: p.meta_color_collection?.value?.trim(),
    finishRaw,
    finish: mapFinish(finishRaw)
  };
}
