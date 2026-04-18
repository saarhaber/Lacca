/**
 * Static-HTML fallback data source for PaintRef.
 *
 * PaintRef's live `colorcodedisplay.cgi` endpoint is served by an old
 * Apache/2.2.3 CGI backend that frequently returns HTTP 503 for hours or
 * days at a time, independent of our request rate. The LiteSpeed frontend,
 * however, serves static `.shtml` files from the `/model/<color>_<name>.shtml`
 * tree reliably even when the CGI backend is down — these are pre-rendered
 * per-model paint galleries that contain the same paint data (year, name,
 * manufacturer code, ditzler code) alongside an actual `bgcolor=#RRGGBB`
 * swatch color. They're a strict superset of what our advanced-search
 * parser needs *except* chip-image URLs: the hex is in the page directly,
 * so we skip chip sampling and go straight to a `paintref_hex` seed.
 *
 * URL shape: `/model/<color>_<model>.shtml`
 *   - Colors (each model has ~11 pages): black, blue, brown, gray, green,
 *     orange, purple, red, silver, white, yellow.
 *   - Model URL = display name with whitespace removed (`3 Series` → `3Series`).
 *
 * To keep request counts manageable we drive the crawl from each OEM's
 * known model list (vPIC + plan-provided overrides). We probe up to
 * (colors × models) URLs per OEM, dedup by paint code, and return the
 * union. 404s are expected and silent. Non-existent model/color combos
 * skip cheaply (LiteSpeed 404s in under 200ms).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PaintRefEntry } from "./paintref.js";
import "./httpDispatcher.js";

const COLORS = [
  "black",
  "blue",
  "brown",
  "gray",
  "green",
  "orange",
  "purple",
  "red",
  "silver",
  "white",
  "yellow"
] as const;

const USER_AGENT = "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)";

/** Per-request ceiling so a stuck TLS handshake to archive.org cannot stall the whole batch. */
const LIVE_FETCH_MS = 45_000;
const WAYBACK_API_MS = 30_000;
const WAYBACK_SNAPSHOT_MS = 90_000;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cachePath(oem: string, model: string, color: string): string {
  // Per-(oem,model,color) cache so we can resume the crawl and skip already-
  // fetched pages.
  const modelKey = createHash("sha1").update(model).digest("hex").slice(0, 10);
  return join(
    repoRoot(),
    "data/sources/paintref/static-shtml",
    slug(oem),
    `${color}--${modelKey}.html`
  );
}

function notFoundMarkerPath(base: string): string {
  return `${base}.404`;
}

type FetchResult =
  | { kind: "ok"; html: string }
  | { kind: "notfound" }
  | { kind: "unavailable" } // 503 / network — do NOT cache; retry later.
  | { kind: "error"; msg: string };

async function fetchStatic(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LIVE_FETCH_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT
      }
    });
    if (res.status === 404) return { kind: "notfound" };
    if (res.status === 503 || res.status === 508 || res.status === 429) {
      return { kind: "unavailable" };
    }
    if (!res.ok) return { kind: "error", msg: `${res.status} ${res.statusText}` };
    const html = await res.text();
    // PaintRef's Apache frontend sometimes smuggles a 503 body back with a
    // 200 status code (LiteSpeed caches upstream errors this way). Treat
    // those as unavailable so the caller can fall through to Wayback.
    if (html.includes("503 Service Unavailable") || html.includes("508 Insufficient")) {
      return { kind: "unavailable" };
    }
    // Archive.org sometimes serves a "wait" spinner page during rate-limiting
    // — reject it so we don't cache garbage.
    if (html.includes('<title>One moment, please...</title>')) {
      return { kind: "unavailable" };
    }
    return { kind: "ok", html };
  } catch (err) {
    return { kind: "error", msg: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Last-resort source for a `/model/*.shtml` page when the live site is
 * down: pull the closest Wayback snapshot via the availability API.
 * Wayback occasionally rate-limits us — we retry once with a short delay
 * and then give up. Successful responses are returned as raw HTML for
 * the caller to parse.
 */
async function fetchFromWayback(originalUrl: string): Promise<FetchResult> {
  try {
    const api =
      `https://archive.org/wayback/available?url=` + encodeURIComponent(originalUrl);
    const probe = await fetch(api, {
      signal: AbortSignal.timeout(WAYBACK_API_MS),
      headers: { "User-Agent": USER_AGENT }
    });
    if (!probe.ok) return { kind: "error", msg: `wayback available: ${probe.status}` };
    const json = (await probe.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; timestamp?: string } };
    };
    const closest = json.archived_snapshots?.closest;
    if (!closest?.available || !closest.timestamp) return { kind: "notfound" };
    const snapshotUrl = `https://web.archive.org/web/${closest.timestamp}id_/${originalUrl}`;
    const res = await fetch(snapshotUrl, {
      signal: AbortSignal.timeout(WAYBACK_SNAPSHOT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT
      }
    });
    if (!res.ok) return { kind: "error", msg: `wayback fetch: ${res.status}` };
    const html = await res.text();
    if (html.includes('<title>One moment, please...</title>')) {
      return { kind: "unavailable" };
    }
    // Wayback returns some pre-rendered "not available" pages that are tiny
    // — require a minimum page body to call it a hit.
    if (html.length < 1000) return { kind: "notfound" };
    return { kind: "ok", html };
  } catch (err) {
    return { kind: "error", msg: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parse a single `/model/<color>_<model>.shtml` document. Extracts one entry
 * per visible paint row. Rows are well-structured: each contains a year cell
 * (carried-over rowspan for grouped years), a swatch cell with
 * `bgcolor=#RRGGBB`, the promotional paint name, the manufacturer paint code,
 * and a `ditzler=…` deep-link. We keep only rows that have a hex and a code
 * or name; rowspan-carry logic re-uses the last year seen whenever the year
 * cell is empty (the page's standard shape when consecutive rows share a year).
 */
export function parseStaticShtml(
  html: string,
  oem: string,
  model: string
): PaintRefEntry[] {
  const out: PaintRefEntry[] = [];
  const rowRegex = /<tr\s[^>]*bgcolor=["']?#([A-Fa-f0-9]{6})["']?[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  let lastYear: number | undefined;
  while ((m = rowRegex.exec(html)) !== null) {
    const rowBg = m[1].toUpperCase();
    // Rows use either #E0E0E0 or #FFFFFF as alternating row backgrounds and
    // #DDDDDD / #F5F6F5 / #dfe0df as page-chrome / header / footer.
    // Only actual data rows (zebra stripes) carry paint entries.
    if (!/^(E0E0E0|FFFFFF)$/i.test(rowBg)) continue;
    const body = m[2];
    // Skip separator rows (`<tr bgcolor=#E0E0E0><td colspan=4></td></tr>`).
    if (/<td\s+colspan=/i.test(body) && !/bgcolor=["']?#[0-9A-Fa-f]{6}/.test(body)) continue;

    // Year: `<td><font size=+2>2000</font></td>` in the first data cell of
    // the year's opening row. Empty <td> on subsequent rows carries forward.
    const yearM = body.match(/<td[^>]*>\s*<font[^>]*size=\+?2[^>]*>\s*(\d{4})\s*<\/font>\s*<\/td>/i);
    if (yearM) lastYear = parseInt(yearM[1], 10);
    const year = lastYear;

    // Swatch hex: a td cell whose bgcolor is the paint color (NOT the row bg).
    // Collect all inner bgcolor values and pick the first non-row-bg non-chrome
    // one.
    const innerBgs = [...body.matchAll(/bgcolor=["']?#([A-Fa-f0-9]{6})["']?/gi)]
      .map((x) => x[1].toUpperCase())
      .filter((h) => !/^(E0E0E0|FFFFFF|DDDDDD|F5F6F5|DFE0DF)$/i.test(h));
    const hex = innerBgs[0];
    if (!hex) continue;

    // Name: each paint row has TWO `<td bgcolor=#HEX>` cells — the first is
    // the swatch tile (empty, just a space) and the second is the name cell
    // (e.g. `<td bgcolor=#C32A1E>Bright Red</td>` or
    //  `<td bgcolor=#6D010E><font color=white>Flamenco Red</font></td>`).
    // We scan all matches for this hex and pick the first with non-trivial
    // text content after optional `<font>` unwrapping.
    const nameCellRegex = new RegExp(
      `<td[^>]*bgcolor=["']?#${hex}["']?[^>]*>([\\s\\S]*?)<\\/td>`,
      "gi"
    );
    let name: string | undefined;
    for (const nm of body.matchAll(nameCellRegex)) {
      const inner = nm[1]
        .replace(/<font[^>]*>/gi, "")
        .replace(/<\/font>/gi, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, "")
        .trim();
      if (inner && inner.length >= 2) {
        name = inner;
        break;
      }
    }
    if (!name) continue;
    // Some pages HTML-encode apostrophes etc.
    name = name.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

    // Manufacturer paint code: third data cell, e.g. `<td align=center> 415</td>`.
    // It can also be a comma list ("184, 630") — take the first token.
    const codeM = body.match(/<td[^>]*align=center[^>]*>\s*([A-Z0-9][A-Z0-9\-]*)/i);
    const rawCode = codeM?.[1]?.trim();
    const code = rawCode && !/^look$/i.test(rawCode) ? rawCode : undefined;

    // Ditzler code: pulled from the "look up" href's `ditzler=` query param,
    // which is the most reliable cross-reference anchor in the page.
    const ditzM = body.match(/ditzler=([^"&]+)/i);
    const ditzler = ditzM?.[1]?.trim();

    // We require at least year + name + hex to be useful. Code is preferred
    // but we'll still emit the entry (keyed on ditzler or name fallback) so
    // the downstream merge can combine with live-CGI rows that do have codes.
    if (!year) continue;
    out.push({
      code: code ?? ditzler ?? `${name.replace(/\W+/g, "")}-${year}`,
      name,
      make: oem,
      model,
      year_from: year,
      year_to: year,
      hex: `#${hex}`,
      ...(ditzler ? { ditzler } as unknown as Record<string, string> : {})
    });
  }
  return out;
}

export interface StaticShtmlFetchOptions {
  /** Full list of candidate model names for this OEM (vPIC + overrides). */
  models: string[];
  /** Optional cap — skip models past this index once aggregate is full. */
  maxModels?: number;
  /** Delay between requests in ms. Default 300. Static pages are cheap. */
  delayMs?: number;
  /** Delay between Wayback fallback requests in ms. Default 1200. */
  waybackDelayMs?: number;
  /**
   * When true, ignore on-disk cache (`.html` + `.html.404`) for each probe so
   * a prior bad run — e.g. transient 404s while PaintRef was misconfigured —
   * cannot permanently skip real pages.
   */
  forceRefresh?: boolean;
}

function mergeEntry(prev: PaintRefEntry | undefined, next: PaintRefEntry): PaintRefEntry {
  if (!prev) return { ...next, models: next.model ? [next.model] : undefined };
  const models = new Set<string>();
  for (const m of prev.models ?? []) models.add(m);
  for (const m of next.models ?? []) models.add(m);
  if (prev.model) models.add(prev.model);
  if (next.model) models.add(next.model);
  const yearFrom = Math.min(
    Number(prev.year_from ?? Infinity),
    Number(next.year_from ?? Infinity)
  );
  const yearTo = Math.max(
    Number(prev.year_to ?? -Infinity),
    Number(next.year_to ?? -Infinity)
  );
  return {
    ...prev,
    ...next,
    year_from: Number.isFinite(yearFrom) ? yearFrom : undefined,
    year_to: Number.isFinite(yearTo) ? yearTo : undefined,
    // Preserve whichever source first populated hex; prefer explicit codes.
    hex: prev.hex ?? next.hex,
    code: prev.code ?? next.code,
    name: prev.name ?? next.name,
    ditzler: (prev as Record<string, string>).ditzler ?? (next as Record<string, string>).ditzler,
    models: models.size ? [...models].sort() : undefined
  } as PaintRefEntry;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Crawl `/model/<color>_<model>.shtml` for every (color, model) combination
 * for `oem`, parse each page, and return the union.
 *
 * Caches each page response on disk (including the empty-404 marker) so a
 * re-run skips pages that don't exist and reuses pages already fetched.
 */
export async function fetchFromStaticShtml(
  oem: string,
  opts: StaticShtmlFetchOptions
): Promise<PaintRefEntry[]> {
  const models = (opts.models ?? []).slice(0, opts.maxModels ?? 500);
  if (models.length === 0) return [];
  const delayMs = opts.delayMs ?? 300;
  const waybackDelayMs = opts.waybackDelayMs ?? 1200; // archive.org rate-limits around ~1 rps.
  const forceRefresh = opts.forceRefresh === true;
  const aggregate = new Map<string, PaintRefEntry>();
  let probes = 0;
  let hits = 0;
  let waybackHits = 0;
  let unavailable = 0;
  for (const model of models) {
    const urlModel = model.replace(/\s+/g, "");
    if (!urlModel) continue;
    for (const color of COLORS) {
      const url = `https://www.paintref.com/model/${color}_${urlModel}.shtml`;
      const cp = cachePath(oem, model, color);
      const cp404 = notFoundMarkerPath(cp);
      probes++;
      let html = "";
      if (forceRefresh) {
        try {
          if (existsSync(cp)) unlinkSync(cp);
          if (existsSync(cp404)) unlinkSync(cp404);
        } catch {
          // ignore — best effort
        }
      }
      if (existsSync(cp)) {
        html = readFileSync(cp, "utf8");
      } else if (existsSync(cp404)) {
        // Known 404 → skip fetch.
        continue;
      } else {
        let result = await fetchStatic(url);
        if (result.kind === "unavailable") {
          // Live 503 — try Wayback. Archive.org works even when LiteSpeed
          // is returning cached 503s for the /model/ tree.
          unavailable++;
          result = await fetchFromWayback(url);
          if (result.kind === "ok") waybackHits++;
          await sleep(waybackDelayMs);
        } else if (result.kind === "ok") {
          await sleep(delayMs);
        }

        if (result.kind === "ok") {
          mkdirSync(dirname(cp), { recursive: true });
          writeFileSync(cp, result.html);
          html = result.html;
        } else if (result.kind === "notfound") {
          mkdirSync(dirname(cp), { recursive: true });
          writeFileSync(cp404, "");
          // No data.
          continue;
        } else {
          // Transient 503/error — do NOT cache; skip this probe so a later
          // retry can pick it up. (No entry for this probe this run.)
          continue;
        }
      }
      if (!html) continue;
      const rows = parseStaticShtml(html, oem, model);
      if (rows.length === 0) continue;
      hits++;
      for (const row of rows) {
        const key = `${row.code ?? row.name}@${row.year_from}`.toUpperCase();
        aggregate.set(key, mergeEntry(aggregate.get(key), row));
      }
    }
  }
  console.log(
    `  [paintref-shtml] ${oem}: ${hits}/${probes} pages had rows → ` +
      `${aggregate.size} unique entries` +
      (waybackHits ? ` (wayback hits=${waybackHits}/${unavailable} unavailable)` : "")
  );
  return [...aggregate.values()];
}
