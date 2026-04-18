/**
 * Reusable PaintRef (paintref.com) client with on-disk caching.
 *
 * Two retrieval strategies:
 *
 *   1. `colordata.cgi` JSON endpoint (preferred when live — may include LAB).
 *   2. `colorcodedisplay.cgi` / `colorcodedisplaym.cgi` advanced-search HTML
 *      (paginated, supports model/year/keyword filters). Hex-only, so
 *      confidence caps at "derived", but the rows carry make/model/year
 *      context that we preserve on the emitted seeds.
 *
 * `mode`:
 *   - "auto"     (default): JSON first, advanced-search fallback.
 *   - "json"     only JSON endpoint.
 *   - "advanced" only advanced-search HTML (skip JSON entirely).
 *
 * Advanced-search accepts optional `filters` (model / year / keywords /
 * yearFrom / yearTo) so callers can target e.g. `{ model: "X3", keywords:
 * "Brooklyn" }` instead of pulling the entire OEM catalog. See
 * `fetch-paintref-colors.ts` / `fetch-paintref-all.ts` for CLI plumbing.
 *
 * Responses are cached on disk at `data/sources/paintref/<slug>.json` (or a
 * filter-aware `<slug>--<hash>.json` when filters are set) so batch runs
 * don't hammer the public endpoint.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ColorSeed, Finish } from "../../src/pipeline/seedHelpers.js";
import { round } from "../../src/pipeline/seedHelpers.js";
// Importing for the side effect: installs a long-timeout undici dispatcher
// so PaintRef's slow (15-20s) responses don't trip Node's 10s connect timeout.
import "./httpDispatcher.js";

export interface PaintRefEntry {
  code?: string;
  name?: string;
  colour?: string;
  color?: string;
  finish?: string;
  type?: string;
  hex?: string;
  rgb?: string | [number, number, number];
  L?: number | string;
  a?: number | string;
  b?: number | string;
  year_from?: number | string;
  year_to?: number | string;
  id?: number | string;
  /** Advanced-search enrichment: the make PaintRef recorded for this row. */
  make?: string;
  /** Advanced-search enrichment: the primary model associated with this code. */
  model?: string;
  /** Union of all models observed for this code across pages / years. */
  models?: string[];
  /**
   * Absolute URL of the chip image PaintRef rendered for this row. Captured
   * from `background-image: url(...)` or `<img src="...">` inside the swatch
   * cell. Downstream, `scripts/lib/chipSampler.ts` fetches and averages this
   * image to derive a LAB value.
   */
  chipUrl?: string;
  /** Short `sha1(chipUrl)` prefix used as the sampler cache key. */
  chipHash?: string;
}

export interface AdvancedSearchFilters {
  /** Model substring — e.g. "X3". Forwarded to `colorcodedisplay.cgi?model=`. */
  model?: string;
  /** Keywords — searched across all fields, e.g. "Brooklyn Grey". */
  keywords?: string;
  /** Single exact year (4-digit). */
  year?: number;
  /** Year-range scan: issue one paginated query per year in [yearFrom, yearTo]. */
  yearFrom?: number;
  yearTo?: number;
  /** Max pages per query. Default 50 (rows=200 → up to 10 000 rows per query). */
  maxPages?: number;
  /** Rows per page. Default 200 (PaintRef's max). */
  rowsPerPage?: number;
}

export interface FetchOptions {
  /** If true, ignore the on-disk cache and always hit the network. */
  forceRefresh?: boolean;
  /** Override the cache directory (default: `<repo>/data/sources/paintref`). */
  cacheDir?: string;
  /** Max age for the on-disk cache before a refetch is required. Default: 30 days. */
  maxAgeMs?: number;
  /**
   * Retrieval strategy. See module docs.
   */
  mode?: "auto" | "json" | "advanced";
  /** Advanced-search filters (only used when the advanced path runs). */
  filters?: AdvancedSearchFilters;
}

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ADVANCED_DELAY_MS = 600;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function oemSlug(oem: string): string {
  return oem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function filtersFingerprint(filters: AdvancedSearchFilters | undefined): string {
  if (!filters) return "";
  const keys = ["model", "keywords", "year", "yearFrom", "yearTo"] as const;
  const payload: Record<string, string | number> = {};
  for (const k of keys) {
    const v = filters[k];
    if (v !== undefined && v !== "") payload[k] = v as string | number;
  }
  if (Object.keys(payload).length === 0) return "";
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha1").update(json).digest("hex").slice(0, 10);
}

function cachePath(
  oem: string,
  cacheDir: string | undefined,
  filters: AdvancedSearchFilters | undefined
): string {
  // New layout: parsed rows live under `raw/` so they're separate from the
  // chip-image cache (`chipimages/`) and the sampler output (`chips/`). Old
  // top-level `data/sources/paintref/<slug>.json` caches from the pre-fix
  // parser are considered stale and intentionally ignored.
  const dir = cacheDir ?? join(repoRoot(), "data/sources/paintref/raw");
  const slug = oemSlug(oem);
  const fp = filtersFingerprint(filters);
  return join(dir, fp ? `${slug}--${fp}.json` : `${slug}.json`);
}

type CacheFile = {
  oem: string;
  fetchedAt: string;
  entries: PaintRefEntry[];
  filters?: AdvancedSearchFilters;
};

function readCache(path: string, maxAgeMs: number): PaintRefEntry[] | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as CacheFile;
    const fetchedAt = new Date(raw.fetchedAt).getTime();
    if (!fetchedAt || Date.now() - fetchedAt > maxAgeMs) return null;
    return raw.entries;
  } catch {
    return null;
  }
}

function writeCache(
  path: string,
  oem: string,
  entries: PaintRefEntry[],
  filters?: AdvancedSearchFilters
): void {
  mkdirSync(dirname(path), { recursive: true });
  const body: CacheFile = {
    oem,
    fetchedAt: new Date().toISOString(),
    entries,
    ...(filters && Object.keys(filters).length ? { filters } : {})
  };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
}

export async function fetchPaintRefEntries(
  oem: string,
  options: FetchOptions = {}
): Promise<PaintRefEntry[]> {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const mode = options.mode ?? "auto";
  const filters = options.filters;
  const path = cachePath(oem, options.cacheDir, filters);

  if (!options.forceRefresh) {
    const cached = readCache(path, maxAgeMs);
    if (cached) {
      console.log(`  [paintref] cache hit for "${oem}" (${cached.length} entries)`);
      return cached;
    }
  }

  let entries: PaintRefEntry[] = [];
  const errors: string[] = [];
  const tryJson = (mode === "auto" || mode === "json") && !filters;
  const tryAdvanced = mode === "auto" || mode === "advanced";

  if (tryJson) {
    try {
      entries = await fetchFromJsonEndpoint(oem);
    } catch (err) {
      errors.push(`json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (entries.length === 0 && tryAdvanced) {
    try {
      entries = await fetchFromAdvancedSearch(oem, filters);
      if (entries.length) {
        console.log(
          `  [paintref] advanced-search produced ${entries.length} entries for "${oem}"` +
            (filters ? ` (filters=${JSON.stringify(filters)})` : "")
        );
      }
    } catch (err) {
      errors.push(`advanced: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (entries.length === 0) {
    throw new Error(
      `PaintRef fetch failed for "${oem}" (mode=${mode}). ` +
        `Attempted ${[tryJson ? "json" : "", tryAdvanced ? "advanced" : ""].filter(Boolean).join(" + ")}. ` +
        `Errors: ${errors.join(" | ")}`
    );
  }

  writeCache(path, oem, entries, filters);
  return entries;
}

async function fetchFromJsonEndpoint(oem: string): Promise<PaintRefEntry[]> {
  // PaintRef's `colordata.cgi` endpoint has been removed from the public site
  // (returns 404). We keep this stub in case it ever comes back, but callers
  // should prefer the advanced-search path. We also switched the public param
  // from `manuf=` to `make=`: PaintRef's advanced search interprets `manuf`
  // as the parent manufacturer (Honda for Acura, Hyundai for Genesis, etc.),
  // so most sub-brands return zero rows under `manuf=`. `make=` matches the
  // brand name directly and works for every OEM in PAINTREF_OEMS.
  const url =
    `https://www.paintref.com/cgi-bin/colordata.cgi?` +
    new URLSearchParams({ make: oem, format: "json" }).toString();

  console.log(`  [paintref] GET ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "lacca-color-pipeline/1.0 (github.com/lacca)"
    }
  });
  if (!res.ok) {
    throw new Error(`json endpoint returned ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `json endpoint returned non-JSON (first 200 chars: ${text.slice(0, 200).replace(/\s+/g, " ")})`
    );
  }
  if (Array.isArray(parsed)) return parsed as PaintRefEntry[];
  if (parsed && typeof parsed === "object" && "Results" in (parsed as object)) {
    return (parsed as { Results: PaintRefEntry[] }).Results;
  }
  if (parsed && typeof parsed === "object" && "data" in (parsed as object)) {
    return (parsed as { data: PaintRefEntry[] }).data;
  }
  throw new Error(`json endpoint returned unknown object shape`);
}

/* ---------------------------- Advanced search ---------------------------- */

async function fetchFromAdvancedSearch(
  oem: string,
  filters?: AdvancedSearchFilters
): Promise<PaintRefEntry[]> {
  const rowsPerPage = filters?.rowsPerPage ?? 200;
  const maxPages = filters?.maxPages ?? 50;

  const aggregate = new Map<string, PaintRefEntry>();

  // Circuit breaker: if the live CGI backend is in one of its long 503
  // windows, we'd otherwise burn 9+ minutes of retries per OEM just to
  // collect zero rows. Track consecutive empty/failed pages and bail early
  // so the outer driver can jump to the static-shtml fallback.
  let consecutiveEmpty = 0;
  const BREAK_AFTER_EMPTY = 4;

  const runQuery = async (extra: Record<string, string>) => {
    let totalRows = 0;
    for (let page = 1; page <= maxPages; page++) {
      const params: Record<string, string> = {
        // Use `make=` (not `manuf=`): PaintRef's advanced search interprets
        // manuf as parent manufacturer (e.g. Honda for Acura), so sub-brands
        // return zero rows. `make=` matches the brand directly.
        make: oem,
        rows: String(rowsPerPage),
        page: String(page),
        ...extra
      };
      const html = await fetchAdvancedHtml(params);
      if (!html) {
        console.warn(
          `  [paintref] ${oem}: no usable HTML for year=${params.year ?? "?"} page=${page} (PaintRef down / rate-limited and no Wayback hit)`
        );
        consecutiveEmpty++;
        break;
      }
      const parsed = parseAdvancedSearchHtml(html, oem);
      if (parsed.length === 0) {
        consecutiveEmpty++;
        break;
      }
      consecutiveEmpty = 0;
      for (const e of parsed) mergeEntry(aggregate, e);
      totalRows += parsed.length;
      await sleep(ADVANCED_DELAY_MS);
      if (parsed.length < rowsPerPage) break;
      if (!hasNextPage(html, page)) break;
    }
    return totalRows;
  };

  const hasYearScan =
    filters?.yearFrom !== undefined && filters?.yearTo !== undefined;

  if (hasYearScan) {
    const from = Math.min(filters!.yearFrom!, filters!.yearTo!);
    const to = Math.max(filters!.yearFrom!, filters!.yearTo!);
    for (let y = from; y <= to; y++) {
      const extra: Record<string, string> = { year: String(y) };
      if (filters?.model) extra.model = filters.model;
      if (filters?.keywords) extra.keywords = filters.keywords;
      console.log(`  [paintref] ${oem}: scanning year ${y} (${from}–${to})…`);
      try {
        const n = await runQuery(extra);
        console.log(
          `  [paintref] ${oem} ${y}: +${n} rows (unique so far: ${aggregate.size})`
        );
      } catch (err) {
        console.warn(
          `  [paintref] ${oem} ${y}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      if (consecutiveEmpty >= BREAK_AFTER_EMPTY && aggregate.size === 0) {
        console.warn(
          `  [paintref] ${oem}: circuit breaker — ${consecutiveEmpty} consecutive empty pages, skipping to static-shtml fallback`
        );
        break;
      }
    }
  } else {
    const extra: Record<string, string> = {};
    if (filters?.year !== undefined) extra.year = String(filters.year);
    if (filters?.model) extra.model = filters.model;
    if (filters?.keywords) extra.keywords = filters.keywords;
    await runQuery(extra);
  }

  if (aggregate.size === 0) {
    throw new Error("advanced-search returned no parseable entries (or rate-limited)");
  }

  return [...aggregate.values()];
}

async function fetchAdvancedHtml(
  params: Record<string, string>
): Promise<string | null> {
  const qs = new URLSearchParams(params).toString();
  // Extra `http://` endpoint: sometimes still routed differently from the
  // overloaded CGI worker behind HTTPS. Single-try on hard 503/508 — retries
  // rarely help when Apache is in a multi-hour 503 window; we prefer to reach
  // Wayback + static-shtml sooner.
  const urls = [
    `https://www.paintref.com/cgi-bin/colorcodedisplay.cgi?${qs}`,
    `https://www.paintref.com/cgi-bin/colorcodedisplaym.cgi?${qs}&mobile=yes`,
    `http://www.paintref.com/cgi-bin/colorcodedisplay.cgi?${qs}`
  ];

  let lastErr: string | null = null;
  urlLoop: for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`  [paintref] GET ${url}${attempt > 0 ? ` (retry ${attempt})` : ""}`);
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)"
          }
        });
        // Hard overload: do not burn 3× retries per URL — try next mirror, then Wayback.
        if (res.status === 503 || res.status === 508) {
          lastErr = `${res.status} ${res.statusText}`;
          continue urlLoop;
        }
        if (res.status === 429) {
          lastErr = `${res.status} ${res.statusText}`;
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = `${res.status} ${res.statusText}`;
          break;
        }
        const html = await res.text();
        // 200 OK with an error document — same as above: fail fast to other URLs / Wayback.
        if (
          html.includes("508 Insufficient Resource") ||
          html.includes("503 Service Unavailable")
        ) {
          lastErr = "503/508 in body";
          continue urlLoop;
        }
        return html;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  // Live site exhausted — fall back to Wayback Machine. Wayback has wide
  // coverage of PaintRef advanced-search URLs (snapshots from 2022-2026) and
  // serves real, fully-rendered HTML — including chip image URLs — so the
  // same parser works against it. When paintref.com's Apache backend is in
  // one of its 503 windows (they last hours at a time), Wayback is the only
  // reliable way to progress. We try the exact URL first, then a couple of
  // degraded variants (strip year, strip model) before giving up.
  const y = params.year ?? "?";
  const pg = params.page ?? "?";
  console.log(
    `  [paintref] live PaintRef exhausted for ${params.make} year=${y} page=${pg} (${lastErr ?? "no response"}) → trying archive.org (often 30–120s of silence per page if IA is slow)`
  );
  const wb = await fetchAdvancedHtmlFromWayback(params, qs);
  if (wb) return wb;

  if (lastErr) console.warn(`  [paintref] advanced fetch failed: ${lastErr} (wayback also empty)`);
  return null;
}

/**
 * Pull a PaintRef advanced-search response out of the Internet Archive.
 *
 * Only worthwhile when the query includes BOTH `make` and `year`: Wayback
 * snapshots of the un-filtered `make=X` endpoint show a cross-reference
 * page with no year or paint-code cells (our parser correctly rejects it).
 * Year-filtered snapshots are the ones that actually carry the same row
 * structure as the live site, so we restrict the fallback to those.
 *
 * Wayback's CDX index is keyed on the exact original URL (case-sensitive
 * on the query string). PaintRef's live URLs bounce between `http`, `https`,
 * `www.paintref.com`, and bare `paintref.com`, so we probe a few canonical
 * forms and accept the first snapshot whose parsed HTML still contains
 * `class="odd"` rows. We fetch via `id_` so Wayback serves raw bytes
 * without its toolbar/rewriting injection.
 *
 * Returns null when no useful snapshot exists (common — Wayback's crawl of
 * paintref.com skews heavily toward unfiltered make pages).
 */
async function fetchAdvancedHtmlFromWayback(
  params: Record<string, string>,
  qs: string
): Promise<string | null> {
  if (!params.make || !params.year) return null;

  const basePaths = [
    "/cgi-bin/colorcodedisplay.cgi",
    "/cgi-bin/colorcodedisplaym.cgi"
  ];
  const hostVariants = [
    "https://www.paintref.com",
    "https://paintref.com",
    "http://www.paintref.com",
    "http://paintref.com"
  ];

  // Try the exact qs first, then a couple of common crawl-friendly variants.
  const compact = new URLSearchParams({
    make: params.make,
    year: params.year,
    rows: "50"
  }).toString();
  const queryVariants = Array.from(new Set([qs, compact]));
  const totalProbes = queryVariants.length * basePaths.length * hostVariants.length;
  let probeIdx = 0;

  for (const q of queryVariants) {
    for (const base of basePaths) {
      for (const host of hostVariants) {
        const originalUrl = `${host}${base}?${q}`;
        probeIdx++;
        console.log(
          `  [paintref] wayback availability ${probeIdx}/${totalProbes} ${host}${base}?…`
        );
        const snapshotUrl = await wayback_closestSnapshot(originalUrl);
        if (!snapshotUrl) continue;
        try {
          console.log(`  [paintref] wayback GET ${snapshotUrl}`);
          const res = await fetch(snapshotUrl, {
            signal: AbortSignal.timeout(90_000),
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "User-Agent": "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)"
            }
          });
          if (!res.ok) continue;
          const html = await res.text();
          if (
            html.includes("508 Insufficient Resource") ||
            html.includes("503 Service Unavailable")
          )
            continue;
          if (!/class="(odd|even)"/.test(html)) continue;
          console.log(`  [paintref] wayback hit (${html.length} bytes)`);
          return html;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  [paintref] wayback fetch error: ${msg}`);
        }
      }
    }
  }
  return null;
}

async function wayback_closestSnapshot(originalUrl: string): Promise<string | null> {
  try {
    const api =
      `https://archive.org/wayback/available?url=` +
      encodeURIComponent(originalUrl);
    const res = await fetch(api, {
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)" }
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; timestamp?: string; url?: string } };
    };
    const closest = json.archived_snapshots?.closest;
    if (!closest?.available || !closest.timestamp) return null;
    // Use the `id_` suffix so Wayback serves raw HTML without injecting its
    // toolbar/rewriting scripts. This keeps the page byte-for-byte what
    // PaintRef served at crawl time, so our regex parser works unchanged.
    // Wayback's availability API returns `closest.url` as an already-wrapped
    // `http://web.archive.org/web/{ts}/{original}` URL; we want to build our
    // OWN wrapped URL (with `id_`) against the bare original, so we ignore
    // `closest.url` and use the input `originalUrl` directly.
    return `https://web.archive.org/web/${closest.timestamp}id_/${originalUrl}`;
  } catch {
    return null;
  }
}

function hasNextPage(html: string, currentPage: number): boolean {
  const nextLink = new RegExp(`[?&]page=${currentPage + 1}\\b`);
  if (nextLink.test(html)) return true;
  if (/\bnext\s*page\b/i.test(html)) return true;
  return false;
}

/* ------------------------------ HTML parser ------------------------------ */

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function looksLikeCode(c: string, oem?: string): boolean {
  if (!c) return false;
  if (oem && c.toUpperCase() === oem.toUpperCase()) return false;
  if (c.length < 2 || c.length > 14) return false;
  if (/^\d{4}$/.test(c)) return false;
  if (!/^[A-Z0-9][A-Z0-9\-\/]*$/i.test(c)) return false;
  return /[0-9]/.test(c) || c.length >= 3;
}

/** Stricter than {@link looksLikeCode}: requires a digit so nav/footer tokens ("membership") are never paint codes. */
function looksLikePaintCode(c: string, oem?: string): boolean {
  if (!looksLikeCode(c, oem)) return false;
  return /[0-9]/.test(c);
}

function looksLikeYear(c: string): boolean {
  return /^(19|20)\d{2}$/.test(c);
}

export function looksLikeName(c: string, oem: string): boolean {
  if (c.length < 3 || c.length > 60) return false;
  if (looksLikeYear(c)) return false;
  if (c.toLowerCase() === oem.toLowerCase()) return false;
  if (!/[a-z]/.test(c)) return false;
  return true;
}

/**
 * Parse one results page. Paint rows are identified by `class="odd"` or
 * `class="even"` and are distinguished from header/navigation rows. Within
 * each row we identify columns by the **query parameter of the first `<a
 * href>` inside each cell** — e.g. a cell whose anchor points at
 * `colorcodedisplay.cgi?code=C03L&...` is the paint-code cell, `?color=...`
 * is the color-name cell, `?make=...` is the make cell, etc. This is much
 * more reliable than guessing from cell text (which previously caused
 * color names like "Blue" to be mis-classified as car models and table
 * UI text like "brochures" to leak into the paint catalog).
 *
 * Hex is extracted **only** from explicit inline `style="background:#RRGGBB"`
 * declarations. PaintRef's sample cells usually carry `background-image:
 * url(/chipimages/XXX.png)` instead — in that case we return no hex and the
 * seed is dropped downstream (the code/name/year/model metadata is still
 * retained for `unionModelsFromEntries` so the scope's model list stays
 * populated).
 */
function decodeQueryValue(v: string): string {
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v.replace(/\+/g, " ");
  }
}

function anchorsInCell(
  cellHtml: string
): Array<{ href: string; text: string; title?: string }> {
  const out: Array<{ href: string; text: string; title?: string }> = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cellHtml)) !== null) {
    const attrs = m[1];
    const inner = stripTags(m[2]);
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const title = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1];
    if (inner) out.push({ href, text: inner, title });
  }
  return out;
}

function hrefParam(href: string, name: string): string | undefined {
  const qIdx = href.indexOf("?");
  const qs = qIdx >= 0 ? href.slice(qIdx + 1) : href;
  for (const pair of qs.split("&")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    if (pair.slice(0, eq).toLowerCase() === name.toLowerCase()) {
      return decodeQueryValue(pair.slice(eq + 1));
    }
  }
  return undefined;
}

/** Parse a cell; classify it by the query-param(s) in its anchors. */
type CellKind =
  | { kind: "year"; year: number }
  | { kind: "make"; make: string }
  | { kind: "model"; model: string }
  | { kind: "color"; name: string }
  | { kind: "code"; codes: string[] }
  | { kind: "ditzler"; ditzler: string }
  | { kind: "unknown" };

function classifyCell(cellHtml: string): CellKind {
  const anchors = anchorsInCell(cellHtml);
  const codes: string[] = [];
  let year: number | undefined;
  let make: string | undefined;
  let model: string | undefined;
  let name: string | undefined;
  let ditzler: string | undefined;

  for (const a of anchors) {
    const yParam = hrefParam(a.href, "year");
    if (yParam && /^(19|20)\d{2}$/.test(yParam)) year = parseInt(yParam, 10);
    const mkParam = hrefParam(a.href, "make");
    if (mkParam) make = a.text || mkParam;
    const mdParam = hrefParam(a.href, "model");
    if (mdParam) model = a.text || mdParam;
    const colorParam = hrefParam(a.href, "color");
    if (colorParam) name = a.text || colorParam;
    const codeParam = hrefParam(a.href, "code");
    if (codeParam) codes.push((a.text || codeParam).trim());
    const ditzlerParam = hrefParam(a.href, "ditzler");
    const tditzlerParam = hrefParam(a.href, "tditzler");
    if (ditzlerParam || tditzlerParam) ditzler = a.text || ditzlerParam || tditzlerParam;
  }

  if (codes.length) return { kind: "code", codes };
  if (year !== undefined) return { kind: "year", year };
  if (make) return { kind: "make", make };
  if (model) return { kind: "model", model };
  if (name) return { kind: "color", name };
  if (ditzler) return { kind: "ditzler", ditzler };
  return { kind: "unknown" };
}

const PAINTREF_BASE_URL = "https://www.paintref.com/";

/**
 * Resolve a possibly-relative chip-image URL against the PaintRef base.
 * Returns `undefined` for obviously invalid (data:, javascript:, etc.) or
 * empty values so the sampler never wastes a network call on garbage.
 */
function resolveChipUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^(data:|javascript:|about:|mailto:)/i.test(trimmed)) return undefined;
  try {
    return new URL(trimmed, PAINTREF_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

/** 16-char sha1 prefix of the chip URL — used as the on-disk cache key. */
export function chipHashOf(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

/**
 * Pull a chip image URL out of a single cell's HTML. PaintRef renders the
 * swatch in several ways: inline `background-image: url(...)` (desktop),
 * `<img src="...">` (mobile skin), or occasionally a `data-bg` attribute.
 * Try each in that priority order and return the first concrete candidate.
 */
function extractChipUrl(cellHtml: string): string | undefined {
  const bgImg = cellHtml.match(
    /background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i
  )?.[1];
  if (bgImg) return resolveChipUrl(bgImg);

  const imgSrc = cellHtml.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (imgSrc) return resolveChipUrl(imgSrc);

  const dataBg = cellHtml.match(/\bdata-bg\s*=\s*["']([^"']+)["']/i)?.[1];
  if (dataBg) return resolveChipUrl(dataBg);

  return undefined;
}

export function parseAdvancedSearchHtml(html: string, oem: string): PaintRefEntry[] {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const out: PaintRefEntry[] = [];

  for (const row of rows) {
    const classAttr = row.match(/<tr\b[^>]*\bclass\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const cls = classAttr.toLowerCase();
    if (cls === "head" || cls.includes("head")) continue;
    if (cls && cls !== "odd" && cls !== "even") continue;

    const cellHtml = row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) ?? [];
    if (cellHtml.length < 4) continue;

    let year: number | undefined;
    let make: string | undefined;
    let model: string | undefined;
    let name: string | undefined;
    const codes: string[] = [];
    let ditzler: string | undefined;
    let hex: string | undefined;
    let chipUrl: string | undefined;

    for (const cell of cellHtml) {
      const k = classifyCell(cell);
      switch (k.kind) {
        case "year":
          year = k.year;
          break;
        case "make":
          make = k.make;
          break;
        case "model":
          model = k.model;
          break;
        case "color":
          name = k.name;
          break;
        case "code":
          for (const c of k.codes) codes.push(c);
          break;
        case "ditzler":
          ditzler = k.ditzler;
          break;
      }

      if (!hex) {
        const bg =
          cell.match(/background(?:-color)?\s*:\s*#([0-9a-fA-F]{6})/i)?.[1] ??
          cell.match(/bgcolor\s*=\s*["']?#([0-9a-fA-F]{6})/i)?.[1];
        if (bg) {
          const up = bg.toUpperCase();
          // Reject obvious decorative backgrounds (table greys).
          if (up !== "E0E0E0" && up !== "F0F0F0" && up !== "FFFFFF" && up !== "000000") {
            hex = `#${up}`;
          }
        }
      }

      if (!chipUrl) {
        const candidate = extractChipUrl(cell);
        if (candidate) chipUrl = candidate;
      }
    }

    if (codes.length === 0) continue;
    const code = codes.find((c) => looksLikePaintCode(c, oem)) ?? codes[0];
    if (!code) continue;
    if (name && name.toLowerCase() === oem.toLowerCase()) continue;

    out.push({
      code,
      name: name?.trim(),
      hex,
      make: make ?? oem,
      model: model?.trim(),
      year_from: year,
      year_to: year,
      ...(chipUrl ? { chipUrl, chipHash: chipHashOf(chipUrl) } : {}),
      ...(ditzler ? { ditzler: ditzler.trim() } as unknown as Record<string, string> : {})
    });
  }

  return out;
}

function mergeEntry(bag: Map<string, PaintRefEntry>, e: PaintRefEntry): void {
  const key = `${(e.code ?? "").toUpperCase()}|${(e.name ?? "").toLowerCase()}`;
  const existing = bag.get(key);
  if (!existing) {
    if (e.model) e.models = [e.model];
    bag.set(key, e);
    return;
  }

  const modelSet = new Set<string>(existing.models ?? []);
  if (existing.model) modelSet.add(existing.model);
  if (e.model) modelSet.add(e.model);
  if (e.models) for (const m of e.models) modelSet.add(m);
  if (modelSet.size) existing.models = [...modelSet].sort();

  const yrs = [existing.year_from, existing.year_to, e.year_from, e.year_to]
    .map((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (yrs.length) {
    existing.year_from = Math.min(...yrs);
    existing.year_to = Math.max(...yrs);
  }

  if (!existing.hex && e.hex) existing.hex = e.hex;
  if (!existing.make && e.make) existing.make = e.make;
  if (!existing.chipUrl && e.chipUrl) {
    existing.chipUrl = e.chipUrl;
    existing.chipHash = e.chipHash;
  }
}

/* ------------------------------ Seed mapping ----------------------------- */

function inferFinish(raw?: string): Finish {
  if (!raw) return "solid";
  const lc = raw.toLowerCase();
  if (lc.includes("matte") || lc.includes("satin") || lc.includes("frozen")) return "matte";
  if (lc.includes("pearl") || lc.includes("tri") || lc.includes("tricoat")) return "pearl";
  if (lc.includes("metallic") || lc.includes("mica") || lc.includes("flake")) return "metallic";
  if (lc === "solid" || lc === "standard") return "solid";
  return "other";
}

function parseNum(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

function parseHex(raw: string): string | undefined {
  const h = raw.replace("#", "").trim().toUpperCase();
  if (h.length === 6 && /^[0-9A-F]{6}$/.test(h)) return `#${h}`;
  return undefined;
}

function parseRgb(
  raw: string | [number, number, number]
): [number, number, number] | undefined {
  if (Array.isArray(raw)) {
    const [r, g, b] = raw;
    if ([r, g, b].every((v) => typeof v === "number" && v >= 0 && v <= 255)) return [r, g, b];
    return undefined;
  }
  const parts = String(raw)
    .split(",")
    .map((x) => parseInt(x.trim(), 10));
  if (parts.length >= 3 && parts.every((v) => !isNaN(v) && v >= 0 && v <= 255)) {
    return [parts[0], parts[1], parts[2]];
  }
  return undefined;
}

function collectModels(entry: PaintRefEntry): string[] {
  const set = new Set<string>();
  if (entry.model) set.add(entry.model);
  if (entry.models) for (const m of entry.models) if (m) set.add(m);
  return [...set].sort();
}

function contextSuffix(entry: PaintRefEntry): string {
  const parts: string[] = [];
  const models = collectModels(entry);
  if (models.length) parts.push(`models=${models.join(", ")}`);
  if (entry.year_from || entry.year_to) {
    const yf = entry.year_from ?? entry.year_to;
    const yt = entry.year_to ?? entry.year_from;
    parts.push(yf === yt ? `year=${yf}` : `years=${yf}-${yt}`);
  }
  return parts.length ? ` (${parts.join("; ")})` : "";
}

/**
 * Lookup shape consumed by {@link paintRefEntryToSeed} when resolving a
 * chip hash to a sampled color. Kept structural (not tied to
 * chipSampler.ts) so unit tests can pass in stubs.
 */
export interface ChipSampleLookup {
  hex: string;
  rgb?: [number, number, number];
  pixels?: number;
}

/**
 * Convert a raw PaintRef entry to a ColorSeed. Returns null when the entry
 * has no usable color data. Priority:
 *   1. Inline LAB from the JSON endpoint → `confidence: "spec"`, `source: "paintref"`.
 *   2. Inline hex from `style="background:#…"` → `confidence: "derived"`, `source: "paintref_hex"`.
 *   3. Chip-image sample resolved via `chipSampler.ts` (keyed by `entry.chipHash`)
 *      → `confidence: "derived"`, `source: "paintref_chip"`. This is the bulk path
 *      now that PaintRef serves chips via `background-image: url(...)` rather than
 *      inline colors.
 *   4. RGB fallback from the JSON endpoint.
 *
 * Advanced-search entries get `models=` and `years=` baked into `note` and
 * `provenanceId` so per-model/per-year context survives into the merged scope.
 */
export function paintRefEntryToSeed(
  entry: PaintRefEntry,
  ctx: {
    oem: string;
    fallbackIdx: number;
    /**
     * Optional lookup that resolves an entry's `chipHash` to a sampled
     * hex. When provided and populated, entries without inline LAB/hex but
     * with a sampled chip land in the `paintref_chip` bucket instead of
     * being dropped.
     */
    chipSamples?: Map<string, ChipSampleLookup>;
  }
): ColorSeed | null {
  const nameRaw = (entry.name ?? entry.colour ?? entry.color ?? "").trim();
  if (entry.code && entry.code.toUpperCase() === ctx.oem.toUpperCase()) {
    return null;
  }
  const code = (entry.code ?? String(ctx.fallbackIdx)).trim();
  const name = nameRaw || `Color ${code}`;
  const finishRaw = entry.finish ?? entry.type;
  const models = collectModels(entry);
  const modelSuffix = models.length ? `:${models[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  const provenanceId = entry.id
    ? `paintref:${entry.id}`
    : `paintref:${ctx.oem}${modelSuffix}:${code}`;
  const suffix = contextSuffix(entry);

  const L = parseNum(entry.L);
  const a = parseNum(entry.a);
  const b = parseNum(entry.b);

  if (L !== undefined && a !== undefined && b !== undefined) {
    return {
      code,
      marketingName: name,
      finish: inferFinish(finishRaw),
      lab: { L: round(L), a: round(a), b: round(b) },
      source: "paintref",
      confidence: "spec",
      provenanceId,
      note:
        `LAB from PaintRef (paintref.com), OEM=${ctx.oem}, code=${code}${suffix}. ` +
        `Treat as spec-grade; verify with spectro before production claims.`
    };
  }

  if (entry.hex) {
    const hex = parseHex(entry.hex);
    if (hex) {
      return {
        code,
        marketingName: name,
        finish: inferFinish(finishRaw),
        hex,
        source: "paintref_hex",
        confidence: "derived",
        provenanceId,
        note:
          `Derived from ${hex} (PaintRef hex, OEM=${ctx.oem}, code=${code}${suffix}). ` +
          `Replace with spectro LAB before production claims.`
      };
    }
  }

  if (entry.chipHash && ctx.chipSamples) {
    const sample = ctx.chipSamples.get(entry.chipHash);
    if (sample) {
      const hex = parseHex(sample.hex);
      if (hex) {
        const pixelsNote = sample.pixels ? `, pixels=${sample.pixels}` : "";
        const urlNote = entry.chipUrl ? `, chipUrl=${entry.chipUrl}` : "";
        return {
          code,
          marketingName: name,
          finish: inferFinish(finishRaw),
          hex,
          source: "paintref_chip",
          confidence: "derived",
          provenanceId: `paintref-chip:${entry.chipHash}`,
          note:
            `Derived from chip-image average ${hex} (PaintRef chip, OEM=${ctx.oem}, ` +
            `code=${code}${suffix}${pixelsNote}${urlNote}). ` +
            `Attribution: paintref.com. Replace with spectro LAB before production claims.`
        };
      }
    }
  }

  if (entry.rgb) {
    const rgb = parseRgb(entry.rgb);
    if (rgb) {
      const [r, g2, b2] = rgb;
      const hexStr = `#${r.toString(16).padStart(2, "0").toUpperCase()}${g2
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}${b2.toString(16).padStart(2, "0").toUpperCase()}`;
      return {
        code,
        marketingName: name,
        finish: inferFinish(finishRaw),
        hex: hexStr,
        source: "paintref_hex",
        confidence: "derived",
        provenanceId,
        note:
          `Derived from rgb(${r},${g2},${b2}) (PaintRef, OEM=${ctx.oem}, code=${code}${suffix}). ` +
          `Replace with spectro LAB before production claims.`
      };
    }
  }

  return null;
}

/**
 * Merge multiple batches of PaintRef entries into a single deduplicated
 * list keyed on `(code, name)`. Used by `fetch-paintref-all.ts` when the
 * batch driver issues separate year and per-model queries for the same
 * OEM — each query returns overlapping rows that should collapse into a
 * single entry whose `models`/year range span the union of inputs.
 */
export function mergePaintRefEntries(batches: PaintRefEntry[][]): PaintRefEntry[] {
  const bag = new Map<string, PaintRefEntry>();
  for (const batch of batches) for (const e of batch) mergeEntry(bag, e);
  return [...bag.values()];
}

/**
 * Union of all model names seen across the supplied PaintRef entries.
 * Callers pass this into `ScopeMeta.models` so the resulting scope lists
 * exactly the models PaintRef had data for.
 */
export function unionModelsFromEntries(entries: PaintRefEntry[]): string[] {
  const seen = new Map<string, string>();
  for (const e of entries) {
    for (const m of collectModels(e)) {
      const k = m.toLowerCase();
      if (!seen.has(k)) seen.set(k, m);
    }
  }
  return [...seen.values()].sort();
}

/** Comprehensive list of OEM slugs known to be served by PaintRef. */
export const PAINTREF_OEMS = [
  "Acura",
  "Alfa Romeo",
  "Alpina",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Bugatti",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lotus",
  "Lucid",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes",
  "Mercury",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Pontiac",
  "Polestar",
  "Porsche",
  "Ram",
  "Rivian",
  "Rolls-Royce",
  "Saab",
  "Saturn",
  "Scion",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo"
] as const;

export function paintRefScopeIdFor(oem: string): string {
  const slug = oemSlug(oem);
  return `${slug}-paintref-v1`;
}
