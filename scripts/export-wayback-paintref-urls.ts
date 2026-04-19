/**
 * Export every distinct archived PaintRef CGI URL from the Internet Archive CDX API
 * (all manufacturers / models encoded in query strings — not live PaintRef).
 *
 * Usage:
 *   tsx scripts/export-wayback-paintref-urls.ts [--out-dir data/sources/wayback-paintref/urls]
 *   tsx scripts/export-wayback-paintref-urls.ts --script chipdisplay.cgi
 *   tsx scripts/export-wayback-paintref-urls.ts --page-size 15000
 *   tsx scripts/export-wayback-paintref-urls.ts --script colorcodedisplay.cgi --continue
 *     (resume after IA 504 or 429; uses sidecar outFile.cdx-state.json)
 *   tsx scripts/export-wayback-paintref-urls.ts --throttle-ms 2000
 *     (pause between CDX pages to reduce rate limits)
 *   tsx scripts/export-wayback-paintref-urls.ts --url-bases "http://paintref.com,https://www.paintref.com"
 *     (comma-separated site roots; /cgi-bin/ is appended if missing; default: all four http/https × www/non-www)
 *   tsx scripts/export-wayback-paintref-urls.ts --url-bases "http://paintref.com" --legacy-filenames
 *     (write chipdisplay.cgi.txt instead of chipdisplay.cgi__http_paintref_com.txt; only valid with exactly one --url-bases)
 *   tsx scripts/export-wayback-paintref-urls.ts --cgi-bin-directory
 *     (one pass per --url-bases: every distinct archived URL under /cgi-bin/, including CGIs not in the default list)
 *   tsx scripts/export-wayback-paintref-urls.ts --with-chipimages
 *     (append: CDX export of /chipimages/ per host after the main job — PNG URLs)
 *   tsx scripts/export-wayback-paintref-urls.ts --subpaths "brochures,chipimages"
 *     (append: arbitrary path segments under each host origin, trailing slash in CDX query)
 *
 * CDX index: https://web.archive.org/cdx/search/cdx
 * Wayback URL browser (wildcard path): web.archive.org → paintref.com/cgi-bin
 */

import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CDX = "https://web.archive.org/cdx/search/cdx";

/**
 * Site roots; each is normalized to .../cgi-bin/ before appending a script name.
 * Includes explicit :80 where IA often stores originals as http://host:80/...
 */
const DEFAULT_URL_BASES = [
  "http://paintref.com",
  "http://paintref.com:80",
  "https://paintref.com",
  "http://www.paintref.com",
  "http://www.paintref.com:80",
  "https://www.paintref.com"
] as const;

const DEFAULT_SCRIPTS = [
  "chipdisplay.cgi",
  "colorcodedisplay.cgi",
  "colorcodedisplaym.cgi",
  "brochuredisplay.cgi",
  "colordata.cgi",
  "colorpage.cgi",
  "colorwhatsnew.cgi"
] as const;

function normalizeUrlBase(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "");
  if (!s.toLowerCase().endsWith("/cgi-bin")) {
    s = `${s}/cgi-bin`;
  }
  return `${s}/`;
}

function cdxPrefixFor(script: string, base: string): string {
  return `${normalizeUrlBase(base)}${script}`;
}

/** Stable fragment for output filenames, e.g. https_www_paintref_com */
function hostKeyFromCdxPrefix(cdxPrefixUrl: string): string {
  const u = new URL(cdxPrefixUrl);
  const proto = u.protocol.replace(":", "");
  const host = u.hostname.replace(/\./g, "_");
  const port = u.port ? `_p${u.port}` : "";
  return `${proto}_${host}${port}`;
}

function cdxLabel(cdxPrefixUrl: string): string {
  try {
    const u = new URL(cdxPrefixUrl);
    const script = u.pathname.split("/").filter(Boolean).pop() ?? u.pathname;
    return `${script} @ ${u.protocol}//${u.host}`;
  } catch {
    return cdxPrefixUrl.slice(0, 96);
  }
}

function cgiBinDirectoryLabel(cdxPrefixUrl: string): string {
  try {
    const u = new URL(cdxPrefixUrl);
    return `ALL /cgi-bin/ @ ${u.protocol}//${u.host}`;
  } catch {
    return cdxPrefixUrl.slice(0, 96);
  }
}

/** Origin only (e.g. http://paintref.com) from a user --url-bases entry. */
function siteOriginFromBase(base: string): string {
  let s = base.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  return new URL(s).origin;
}

function subdirExportLabel(cdxPrefixUrl: string): string {
  try {
    const u = new URL(cdxPrefixUrl);
    const seg = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ?? "path";
    return `${seg}/ @ ${u.protocol}//${u.host}`;
  } catch {
    return cdxPrefixUrl.slice(0, 96);
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val =
        argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function isResumeKeyRow(row: unknown): row is [string] {
  return (
    Array.isArray(row) &&
    row.length === 1 &&
    typeof row[0] === "string" &&
    row[0].length > 30 &&
    /^[A-Za-z0-9+/=_-]+$/.test(row[0])
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function cdxBatch(
  cdxUrlPrefix: string,
  logLabel: string,
  resumeKey: string | null,
  pageSize: number
): Promise<{ originals: string[]; nextResume: string | null }> {
  const params = new URLSearchParams({
    url: cdxUrlPrefix,
    matchType: "prefix",
    output: "json",
    fl: "original",
    collapse: "urlkey",
    limit: String(pageSize),
    showResumeKey: "true"
  });
  if (resumeKey) {
    params.set("resumeKey", resumeKey);
  }
  const url = `${CDX}?${params}`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    lastStatus = res.status;
    if (res.ok) {
      const data: unknown = await res.json();
      return parseCdxJson(data);
    }
    if (
      res.status === 504 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 429
    ) {
      const wait = Math.min(120_000, 8000 * Math.pow(1.5, attempt));
      process.stderr.write(
        `CDX ${res.status} ${logLabel} attempt ${attempt + 1}/12, wait ${Math.round(wait / 1000)}s\n`
      );
      await sleep(wait);
      continue;
    }
    throw new Error(
      `CDX ${res.status} for ${logLabel} resumeKey=${resumeKey ? "set" : "none"}`
    );
  }
  throw new Error(
    `CDX gave up after retries (${lastStatus}) ${logLabel} resumeKey=${resumeKey ? "set" : "none"}`
  );
}

function parseCdxJson(data: unknown): {
  originals: string[];
  nextResume: string | null;
} {
  if (!Array.isArray(data) || data.length < 2) {
    return { originals: [], nextResume: null };
  }
  let end = data.length;
  let nextResume: string | null = null;
  const last = data[data.length - 1];
  if (isResumeKeyRow(last)) {
    nextResume = last[0];
    end -= 1;
  }
  const rows = data.slice(1, end) as string[][];
  const originals = rows.map((r) => r[0]).filter(Boolean);
  return { originals, nextResume };
}

type CdxState = { nextResumeKey: string | null; total: number };

async function exportScript(
  cdxUrlPrefix: string,
  logLabel: string,
  outFile: string,
  pageSize: number,
  continueRun: boolean,
  throttleMs: number
): Promise<number> {
  await mkdir(dirname(outFile), { recursive: true });
  const statePath = `${outFile}.cdx-state.json`;
  let total = 0;
  let resume: string | null = null;
  let append = false;

  if (continueRun) {
    try {
      const raw = await readFile(statePath, "utf8");
      const s = JSON.parse(raw) as CdxState;
      if (typeof s.total === "number") {
        total = s.total;
      }
      resume = s.nextResumeKey;
      append = total > 0;
      process.stderr.write(
        `${logLabel} --continue state total=${total} nextResume=${resume ? "yes" : "null(done)"}\n`
      );
      if (resume === null && total > 0) {
        process.stderr.write(`${logLabel} checkpoint says complete\n`);
        return total;
      }
    } catch {
      process.stderr.write(
        `${logLabel} --continue: no valid ${statePath}, starting fresh\n`
      );
    }
  } else {
    await unlink(statePath).catch(() => {});
  }

  const stream = createWriteStream(outFile, {
    encoding: "utf8",
    flags: append ? "a" : "w"
  });
  let batchNum = 0;
  try {
    for (;;) {
      const { originals, nextResume } = await cdxBatch(
        cdxUrlPrefix,
        logLabel,
        resume,
        pageSize
      );
      if (originals.length === 0 && !nextResume) {
        break;
      }
      for (const line of originals) {
        stream.write(line + "\n");
      }
      total += originals.length;
      process.stderr.write(
        `${logLabel} batch ${batchNum} +${originals.length} (total ${total}) next=${nextResume ? "yes" : "no"}\n`
      );
      batchNum += 1;
      await writeFile(
        statePath,
        JSON.stringify({
          nextResumeKey: nextResume,
          total
        } satisfies CdxState)
      );
      if (!nextResume) {
        await unlink(statePath).catch(() => {});
        break;
      }
      resume = nextResume;
      if (throttleMs > 0) {
        await sleep(throttleMs);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      stream.end((err: Error | null | undefined) =>
        err ? reject(err) : resolve()
      );
    });
  }
  return total;
}

const args = parseArgs(process.argv.slice(2));
const outDir =
  args["out-dir"] ??
  join(dirname(fileURLToPath(import.meta.url)), "../data/sources/wayback-paintref/urls");
const pageSize = Math.max(
  1000,
  Math.min(50_000, parseInt(args["page-size"] ?? "50000", 10))
);
const single = args["script"];
const continueRun = args["continue"] === "true";
const throttleMs = Math.max(
  0,
  parseInt(args["throttle-ms"] ?? "1200", 10)
);

function parseUrlBases(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [...DEFAULT_URL_BASES];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Extra path segments under each host (e.g. chipimages → /chipimages/). */
function parseExtraSubpaths(
  raw: string | undefined,
  withChipimages: boolean
): string[] {
  const seen = new Set<string>();
  const add = (part: string) => {
    const t = part
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/\/+/g, "/");
    if (t) {
      seen.add(t);
    }
  };
  if (raw?.trim()) {
    for (const p of raw.split(",")) {
      add(p);
    }
  }
  if (withChipimages) {
    add("chipimages");
  }
  return [...seen];
}

function subpathFileSlug(subpath: string): string {
  return subpath.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
}

async function main(): Promise<void> {
  const cgiBinDirectory = args["cgi-bin-directory"] === "true";
  const withChipimages = args["with-chipimages"] === "true";
  const extraSubpaths = parseExtraSubpaths(args["subpaths"], withChipimages);
  const scripts = single ? [single] : [...DEFAULT_SCRIPTS];
  const urlBases = parseUrlBases(args["url-bases"]);
  const legacyFilenames = args["legacy-filenames"] === "true";
  if (legacyFilenames && urlBases.length !== 1) {
    throw new Error(
      "--legacy-filenames requires exactly one --url-bases entry (e.g. --url-bases http://paintref.com)"
    );
  }
  if (cgiBinDirectory && single) {
    throw new Error("Use either --script or --cgi-bin-directory, not both");
  }
  if (cgiBinDirectory && legacyFilenames) {
    throw new Error(
      "--cgi-bin-directory cannot be combined with --legacy-filenames"
    );
  }
  if (legacyFilenames && extraSubpaths.length > 1) {
    throw new Error(
      "--legacy-filenames with multiple --subpaths (or --with-chipimages + --subpaths) would overwrite files; use host-suffixed names instead"
    );
  }

  await mkdir(outDir, { recursive: true });
  const summary: string[] = [];

  if (cgiBinDirectory) {
    for (const base of urlBases) {
      const cdxPrefix = normalizeUrlBase(base);
      const logLabel = cgiBinDirectoryLabel(cdxPrefix);
      const outFile = join(
        outDir,
        `ALL_cgi-bin__${hostKeyFromCdxPrefix(cdxPrefix)}.txt`
      );
      const n = await exportScript(
        cdxPrefix,
        logLabel,
        outFile,
        pageSize,
        continueRun,
        throttleMs
      );
      let bytes = 0;
      try {
        bytes = (await stat(outFile)).size;
      } catch {
        /* empty */
      }
      summary.push(`${logLabel}\t${n}\t${outFile}\t${bytes} bytes`);
    }
  } else {
    for (const base of urlBases) {
      for (const script of scripts) {
        const cdxPrefix = cdxPrefixFor(script, base);
        const logLabel = cdxLabel(cdxPrefix);
        const safe = script.replace(/[^\w.-]+/g, "_");
        const outFile = legacyFilenames
          ? join(outDir, `${safe}.txt`)
          : join(outDir, `${safe}__${hostKeyFromCdxPrefix(cdxPrefix)}.txt`);
        const n = await exportScript(
          cdxPrefix,
          logLabel,
          outFile,
          pageSize,
          continueRun,
          throttleMs
        );
        let bytes = 0;
        try {
          bytes = (await stat(outFile)).size;
        } catch {
          /* empty */
        }
        summary.push(`${logLabel}\t${n}\t${outFile}\t${bytes} bytes`);
      }
    }
  }

  for (const sub of extraSubpaths) {
    for (const base of urlBases) {
      const origin = siteOriginFromBase(base);
      const cdxPrefix = `${origin}/${sub}/`;
      const logLabel = subdirExportLabel(cdxPrefix);
      const slug = subpathFileSlug(sub);
      const outFile = legacyFilenames
        ? join(outDir, `${slug}.txt`)
        : join(outDir, `${slug}__${hostKeyFromCdxPrefix(cdxPrefix)}.txt`);
      const n = await exportScript(
        cdxPrefix,
        logLabel,
        outFile,
        pageSize,
        continueRun,
        throttleMs
      );
      let bytes = 0;
      try {
        bytes = (await stat(outFile)).size;
      } catch {
        /* empty */
      }
      summary.push(`${logLabel}\t${n}\t${outFile}\t${bytes} bytes`);
    }
  }

  process.stderr.write("\n--- summary (label\trows\tfile\tsize) ---\n");
  for (const line of summary) {
    process.stderr.write(line + "\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
