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
  const dir = cacheDir ?? join(repoRoot(), "data/sources/paintref");
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
  const url =
    `https://www.paintref.com/cgi-bin/colordata.cgi?` +
    new URLSearchParams({ manuf: oem, format: "json" }).toString();

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

  const runQuery = async (extra: Record<string, string>) => {
    let totalRows = 0;
    for (let page = 1; page <= maxPages; page++) {
      const params: Record<string, string> = {
        manuf: oem,
        rows: String(rowsPerPage),
        page: String(page),
        ...extra
      };
      const html = await fetchAdvancedHtml(params);
      if (!html) break;
      const parsed = parseAdvancedSearchHtml(html, oem);
      if (parsed.length === 0) break;
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
  const urls = [
    `https://www.paintref.com/cgi-bin/colorcodedisplay.cgi?${qs}`,
    `https://www.paintref.com/cgi-bin/colorcodedisplaym.cgi?${qs}&mobile=yes`
  ];

  let lastErr: string | null = null;
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`  [paintref] GET ${url}${attempt > 0 ? ` (retry ${attempt})` : ""}`);
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)"
          }
        });
        if (res.status === 508 || res.status === 429 || res.status === 503) {
          lastErr = `${res.status} ${res.statusText}`;
          await sleep(1500 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = `${res.status} ${res.statusText}`;
          break;
        }
        const html = await res.text();
        if (html.includes("508 Insufficient Resource")) {
          lastErr = "508 Insufficient Resource (in body)";
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return html;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  if (lastErr) console.warn(`  [paintref] advanced fetch failed: ${lastErr}`);
  return null;
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

function looksLikeName(c: string, oem: string): boolean {
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
 * Convert a raw PaintRef entry to a ColorSeed. Returns null when the entry
 * has no usable color data. Upgrades LAB-bearing entries to `spec` confidence;
 * other entries fall back to hex → LAB (`derived`). Advanced-search entries
 * also get `models=` and `years=` baked into `note` and `provenanceId` so the
 * per-model / per-year context survives into the merged scope.
 */
export function paintRefEntryToSeed(
  entry: PaintRefEntry,
  ctx: { oem: string; fallbackIdx: number }
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
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
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
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes",
  "Mercury",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Pontiac",
  "Porsche",
  "Ram",
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
