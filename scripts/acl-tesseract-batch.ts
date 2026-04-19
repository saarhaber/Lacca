/**
 * Batch-extract AclLabelRecord rows from Auto Color Library chip JPEGs using
 * Tesseract OCR (word boxes) + mean RGB sampling above each detected code.
 *
 * Targets OEMs that do not yet have a non-empty *-paintref-v1 scope so we
 * enrich the website without trampling PaintRef-backed catalogs in the UI
 * (make-level merge dedupes by code; PaintRef scopes sort first).
 *
 *   npx tsx scripts/acl-tesseract-batch.ts [--dry-run] [--concurrency 6] [--max N]
 *
 * Writes:
 *   data/sources/autocolorlibrary/labels/tesseract-batch/<oem-slug>.json
 *
 * Then import per OEM:
 *   npx tsx scripts/import-autocolorlibrary-labels.ts --in <file>
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { AclLabelRecord } from "./import-autocolorlibrary-labels.js";
import { finalizeMarketingName } from "./lib/acl-marketing-name.js";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]!.startsWith("--")) {
      const key = argv[i]!.slice(2);
      const val = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : "true";
      out[key] = val;
    }
  }
  return out;
}

/** OEM (lowercase) -> has non-empty PaintRef scope */
function loadPaintRefOemsWithPaints(): Set<string> {
  const root = join(repoRoot(), "data/oem");
  const set = new Set<string>();
  for (const d of readdirSync(root)) {
    if (!d.endsWith("-paintref-v1")) continue;
    const scopePath = join(root, d, "oem-scope.json");
    const extPath = join(root, d, "exterior-paints-v1.json");
    if (!existsSync(scopePath) || !existsSync(extPath)) continue;
    const n = (JSON.parse(readFileSync(extPath, "utf8")) as { paints?: unknown[] }).paints?.length ?? 0;
    if (n > 0) {
      const oem = (JSON.parse(readFileSync(scopePath, "utf8")) as { oem: string }).oem.trim().toLowerCase();
      set.add(oem);
    }
  }
  return set;
}

function parseH2(html: string): { year: number; heading: string } | null {
  const m = html.match(/border-title[^>]*>\s*<h2>\s*(\d{4})\s+([^<]+)/i);
  if (!m) return null;
  return { year: Number(m[1]), heading: m[2]!.trim() };
}

/** Map page heading + HTML to vPIC-aligned OEM label(s) for make-level catalogs */
function targetOems(heading: string, html: string, pageDir: string): string[] {
  const t = heading.replace(/\s+/g, " ").trim();
  const tl = t.toLowerCase();
  if (tl === "gm") return ["Chevrolet", "GMC", "Buick", "Cadillac"];
  if (tl === "mercedes benz") return ["Mercedes-Benz"];
  if (tl === "landrover") return ["Land Rover"];
  if (tl === "kia motors") return ["Kia"];
  if (tl === "smart car") return ["Smart"];
  const combinedHondaAcura =
    /HondaAcura/i.test(html) || /Honda\s*\/\s*Acura/i.test(html) || /Acura.*Honda/i.test(html);
  if (combinedHondaAcura) return ["Honda", "Acura"];
  return [t];
}

function filterNeedPaintData(oems: string[], paintRef: Set<string>): string[] {
  return oems.filter((o) => !paintRef.has(o.trim().toLowerCase()));
}

type TsvWord = {
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
  lineKey: string;
};

function parseTsv(tsv: string): TsvWord[] {
  const lines = tsv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: TsvWord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split("\t");
    if (cols.length < 12) continue;
    const level = Number(cols[0]);
    if (level !== 5) continue;
    const text = cols[11]!.trim();
    if (!text) continue;
    const conf = Number(cols[10]);
    rows.push({
      left: Number(cols[6]),
      top: Number(cols[7]),
      width: Number(cols[8]),
      height: Number(cols[9]),
      conf: Number.isFinite(conf) ? conf : 0,
      text,
      lineKey: [cols[1], cols[2], cols[3], cols[4]].join(":")
    });
  }
  return rows;
}

function stripPunct(s: string): string {
  return s.replace(/[.,;:!?]+$/g, "").replace(/^[$]+/, "");
}

type Collapsed = TsvWord & { text: string };

/** Merge split OCR tokens (e.g. Mercedes 040 / 9040) into one logical code span */
function collapseLineWords(words: TsvWord[]): Collapsed[] {
  const sorted = [...words].sort((a, b) => a.left - b.left);
  const out: Collapsed[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    const t0 = stripPunct(a.text);
    const b = sorted[i + 1];
    const c = sorted[i + 2];
    if (/^\d{3}$/.test(t0) && b?.text === "/" && c) {
      const t2 = stripPunct(c.text).replace(/^\$/,"");
      if (/^[A-Za-z]?\d{3,5}$/.test(t2)) {
        const right = c.left + c.width;
        out.push({
          ...a,
          text: `${t0}/${t2}`,
          width: right - a.left,
          conf: Math.min(a.conf, b.conf, c.conf)
        });
        i += 2;
        continue;
      }
    }
    if (/^\d{3,4}$/.test(t0) && b?.text === "/" && c) {
      const t2 = stripPunct(c.text);
      if (/^\d{3,5}$/.test(t2)) {
        const right = c.left + c.width;
        out.push({
          ...a,
          text: `${t0}/${t2}`,
          width: right - a.left,
          conf: Math.min(a.conf, b.conf, c.conf)
        });
        i += 2;
        continue;
      }
    }
    out.push({ ...a, text: a.text });
  }
  return out;
}

const STOPWORDS = new Set(
  "b/c bc met pri prl ford page models model most ext exterior interieur".split(" ")
);

function isNoiseWord(s: string): boolean {
  const u = s.toLowerCase();
  if (STOPWORDS.has(u)) return true;
  if (/^m(?:us|kt|kz|kc)$/i.test(s)) return false;
  if (/^#{0,1}[0-9a-f]{6}$/i.test(s)) return true;
  return false;
}

function looksLikePaintCode(raw: string, matesOnLine: string[]): boolean {
  const s = stripPunct(raw);
  if (s.length < 2 || s.length > 32) return false;
  if (isNoiseWord(s)) return false;
  if (/^\d{6}$/.test(s)) return false;
  if (/^[A-Z]{2,}$/.test(s) && !/[0-9]/.test(s) && s.length <= 4) {
    const lineHasAlnumCodes = matesOnLine.some((m) => /^[A-Z0-9]{1,3}[0-9]{2,4}/i.test(stripPunct(m)));
    if (!lineHasAlnumCodes) return false;
  }
  if (/^[A-Z0-9]{1,3}\/[A-Z0-9]{1,3}\/M[0-9]{4}/i.test(s)) return true;
  if (/^[A-Z0-9]{1,3}\/M[0-9]{4}/i.test(s)) return true;
  if (/^\d{3}\/[A-Za-z]?\d{3,5}$/.test(s)) return true;
  if (/^\d{3,4}\/\d{3,5}$/.test(s)) return true;
  if (/^[A-Z]{1,3}[0-9]{2,4}[A-Z]?$/i.test(s) && /[0-9]/.test(s)) return true;
  if (/^NH[A-Z0-9]{1,4}$/i.test(s)) return true;
  if (/^R\d$/i.test(s)) return false;
  return false;
}

function finishFromName(name: string): string {
  const n = name.toLowerCase();
  if (/\bmatte\b|\bmatt\b|magno/i.test(n)) return "matte";
  if (/\bprl\b|\bpearl\b|\bpri\b|\b3ct\b/i.test(n)) return "pearl";
  if (/\bmet\b|\bmetal/i.test(n)) return "metallic";
  return "solid";
}

function runTesseractTsv(imagePath: string): TsvWord[] {
  const tmp = join(repoRoot(), ".tmp-acl-tsv-" + process.pid + "-" + Math.random().toString(36).slice(2));
  try {
    execFileSync("tesseract", [imagePath, tmp, "-l", "eng", "--psm", "6", "tsv"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const tsv = readFileSync(tmp + ".tsv", "utf8");
    return parseTsv(tsv);
  } finally {
    try {
      if (existsSync(tmp + ".tsv")) unlinkSync(tmp + ".tsv");
    } catch {
      /* ignore */
    }
  }
}

async function meanHexInRegion(
  imagePath: string,
  left: number,
  top: number,
  w: number,
  h: number
): Promise<string> {
  const buf = await sharp(imagePath)
    .extract({
      left: Math.max(0, Math.floor(left)),
      top: Math.max(0, Math.floor(top)),
      width: Math.max(1, Math.floor(w)),
      height: Math.max(1, Math.floor(h))
    })
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data } = buf;
  const r = data[0]!;
  const g = data[1]!;
  const b = data[2]!;
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Only the first OCR line(s) immediately under the code row — not model-key /
 * reference lines further down (those poison multi-column names).
 */
function collectFirstNameLineBelow(
  codeBottom: number,
  lineGroups: Map<string, TsvWord[]>,
  maxFirstLineGapPx: number,
  baselineSlopPx: number
): Collapsed[] {
  type LineMin = { lineKey: string; minTop: number; words: TsvWord[] };
  const lines: LineMin[] = [];
  for (const [lineKey, words] of lineGroups) {
    if (!words.length) continue;
    const minTop = Math.min(...words.map((w) => w.top));
    if (minTop > codeBottom + 4 && minTop < codeBottom + maxFirstLineGapPx) {
      lines.push({ lineKey, minTop, words });
    }
  }
  if (lines.length === 0) return [];
  lines.sort((a, b) => a.minTop - b.minTop);
  const y0 = lines[0]!.minTop;
  const out: Collapsed[] = [];
  for (const L of lines) {
    if (Math.abs(L.minTop - y0) <= baselineSlopPx) {
      out.push(...collapseLineWords(L.words));
    }
  }
  out.sort((a, b) => a.left - b.left);
  return out;
}

function isNameToken(s: string, allTexts: string[]): boolean {
  const t = stripPunct(s);
  if (!t) return false;
  if (/^\d{5,8}$/.test(t)) return false;
  if (looksLikePaintCode(t, allTexts)) return false;
  if (isNoiseWord(t)) return false;
  return true;
}

function columnXBounds(sortedCodes: Collapsed[], index: number): [number, number] {
  const c = sortedCodes[index]!;
  const prev = sortedCodes[index - 1];
  const next = sortedCodes[index + 1];
  const leftX = prev ? (prev.left + prev.width + c.left) / 2 : Math.max(0, c.left - 100);
  const rightX = next ? (c.left + c.width + next.left) / 2 : c.left + c.width + 100;
  return [leftX, rightX];
}

function assignNamesForRow(codes: Collapsed[], lineGroups: Map<string, TsvWord[]>): Map<string, string> {
  const nameMap = new Map<string, string>();
  if (codes.length === 0) return nameMap;

  const codeBottom = Math.max(...codes.map((c) => c.top + c.height));
  const candidates = collectFirstNameLineBelow(codeBottom, lineGroups, 58, 10);
  const allTexts = candidates.map((x) => x.text);
  const nameParts = candidates.filter((w) => isNameToken(w.text, allTexts));

  const sortedCodes = [...codes].sort((a, b) => a.left - b.left);

  if (sortedCodes.length === 1) {
    const c0 = sortedCodes[0]!;
    const [L, R] = columnXBounds(sortedCodes, 0);
    const chunk = nameParts.filter((w) => {
      const wx = w.left + w.width / 2;
      return wx >= L && wx <= R;
    });
    const raw = chunk.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();
    nameMap.set(c0.text, finalizeMarketingName(stripPunct(c0.text), raw || ""));
    return nameMap;
  }

  if (nameParts.length === 0) {
    for (const c of sortedCodes) {
      nameMap.set(c.text, finalizeMarketingName(stripPunct(c.text), ""));
    }
    return nameMap;
  }

  for (let i = 0; i < sortedCodes.length; i++) {
    const c = sortedCodes[i]!;
    const [leftX, rightX] = columnXBounds(sortedCodes, i);
    const chunk = nameParts.filter((w) => {
      const wx = w.left + w.width / 2;
      return wx >= leftX && wx < rightX;
    });
    const raw = chunk.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim();
    nameMap.set(c.text, finalizeMarketingName(stripPunct(c.text), raw || ""));
  }
  return nameMap;
}

/**
 * Returns false for images that are clearly not color-chip sheets:
 * too small, or nearly monochrome (logos, text-only catalog pages).
 */
async function isChipSheetImage(absImage: string): Promise<boolean> {
  const meta = await sharp(absImage).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 300 || h < 300) return false;
  // Sample a 10×10 grid of pixels; compute per-channel std-dev
  const { data } = await sharp(absImage)
    .resize(10, 10, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < data.length; i += 3) { sumR += data[i]!; sumG += data[i + 1]!; sumB += data[i + 2]!; }
  const mR = sumR / n, mG = sumG / n, mB = sumB / n;
  let varR = 0, varG = 0, varB = 0;
  for (let i = 0; i < data.length; i += 3) {
    varR += (data[i]! - mR) ** 2;
    varG += (data[i + 1]! - mG) ** 2;
    varB += (data[i + 2]! - mB) ** 2;
  }
  const stdDev = Math.sqrt((varR + varG + varB) / (3 * n));
  // Chip sheets have multiple distinct colors → high variance; logos/text pages are low-variance
  return stdDev >= 18;
}

async function extractFromImage(
  absImage: string,
  relImage: string,
  modelYear: number,
  sourcePageUrl: string,
  minConf: number
): Promise<AclLabelRecord[]> {
  let words: TsvWord[];
  try {
    words = runTesseractTsv(absImage);
  } catch {
    return [];
  }
  const byLine = new Map<string, TsvWord[]>();
  for (const w of words) {
    if (w.conf > 0 && w.conf < minConf) continue;
    const arr = byLine.get(w.lineKey) ?? [];
    arr.push(w);
    byLine.set(w.lineKey, arr);
  }
  const allCollapsed: Collapsed[] = [];
  for (const [, lineWords] of byLine) allCollapsed.push(...collapseLineWords(lineWords));
  const matesAll = allCollapsed.map((c) => c.text);
  const codeCandidates = allCollapsed.filter((c) => looksLikePaintCode(c.text, matesAll));
  const rowBuckets = new Map<number, Collapsed[]>();
  for (const c of codeCandidates) {
    const k = Math.round(c.top / 25) * 25;
    const arr = rowBuckets.get(k) ?? [];
    arr.push(c);
    rowBuckets.set(k, arr);
  }
  const isStrongCode = (t: string) => /\/[A-Z]?\d{3,5}/i.test(stripPunct(t));
  const codeRows = [...rowBuckets.values()].filter(
    (r) => r.length >= 2 || (r.length === 1 && isStrongCode(r[0]!.text))
  );
  const out: AclLabelRecord[] = [];
  const { width: W = 0, height: H = 0 } = await sharp(absImage).metadata();
  for (const row of codeRows) {
    if (row.length === 0) continue;
    row.sort((a, b) => a.left - b.left);
    const nameByCode = assignNamesForRow(row, byLine);
    for (const c of row) {
      const chipW = Math.max(c.width + 60, 150);
      const chipH = 210;
      const cx = c.left + c.width / 2;
      let chipLeft = Math.round(cx - chipW / 2);
      let chipTop = Math.max(0, c.top - chipH - 35);
      chipLeft = Math.max(0, Math.min(chipLeft, W - chipW));
      chipTop = Math.max(0, Math.min(chipTop, H - chipH));
      const hex = await meanHexInRegion(absImage, chipLeft, chipTop, chipW, chipH);
      const mk = nameByCode.get(c.text) ?? finalizeMarketingName(stripPunct(c.text), "");
      out.push({
        oem: "",
        modelYear,
        sourcePageUrl,
        imageFile: relImage,
        bbox: { x: chipLeft, y: chipTop, w: chipW, h: chipH },
        hex,
        code: stripPunct(c.text),
        marketingName: mk.slice(0, 200),
        finish: finishFromName(mk),
        notes: `Tesseract batch: code conf≈${c.conf.toFixed(0)}; verify chip alignment.`
      });
    }
  }
  return out;
}

function scopeSlug(oem: string): string {
  return oem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dry = args["dry-run"] === "true";
  const concurrency = Math.max(1, Math.min(12, Number(args["concurrency"] ?? "6") || 6));
  const maxImages = args["max"] ? Number(args["max"]) : Infinity;

  const paintRef = loadPaintRefOemsWithPaints();
  const sitePath = join(repoRoot(), "data/sources/autocolorlibrary/site-index.json");
  const site = JSON.parse(readFileSync(sitePath, "utf8")) as {
    entries: Array<{ dir: string; error: string | null; imageCount: number }>;
  };

  type Job = {
    abs: string;
    rel: string;
    year: number;
    pageUrl: string;
    oems: string[];
  };
  const jobs: Job[] = [];

  for (const e of site.entries) {
    if (e.error || !e.imageCount) continue;
    const pagePath = join(repoRoot(), "data/sources/autocolorlibrary/pages", e.dir, "page.html");
    const manPath = join(repoRoot(), "data/sources/autocolorlibrary/pages", e.dir, "manifest.json");
    if (!existsSync(pagePath) || !existsSync(manPath)) continue;
    const html = readFileSync(pagePath, "utf8");
    const h2 = parseH2(html);
    if (!h2) continue;
    const oemsAll = targetOems(h2.heading, html, e.dir);
    const oems = filterNeedPaintData(oemsAll, paintRef);
    if (oems.length === 0) continue;

    const man = JSON.parse(readFileSync(manPath, "utf8")) as {
      pageUrl: string;
      images: Array<{ localRelative?: string; status?: number }>;
    };
    for (const im of man.images ?? []) {
      const lr = im.localRelative ?? "";
      if (!/\.(jpe?g|png)$/i.test(lr)) continue;
      if (/globalhomehead|logo|\.svg/i.test(lr)) continue;
      if (im.status && im.status !== 200) continue;
      const abs = join(repoRoot(), "data/sources/autocolorlibrary/pages", e.dir, lr);
      if (!existsSync(abs)) continue;
      const rel = `data/sources/autocolorlibrary/pages/${e.dir}/${lr}`;
      jobs.push({ abs, rel, year: h2.year, pageUrl: man.pageUrl, oems });
    }
  }

  jobs.sort((a, b) => b.year - a.year || a.rel.localeCompare(b.rel));

  console.log(`Jobs: ${jobs.length} images across OEMs needing paint data (concurrency=${concurrency})`);
  let processed = 0;
  const byOem = new Map<string, AclLabelRecord[]>();

  const runOne = async (j: Job) => {
    if (!(await isChipSheetImage(j.abs))) return;
    const recs = await extractFromImage(j.abs, j.rel, j.year, j.pageUrl, 40);
    for (const oem of j.oems) {
      for (const r of recs) {
        const copy = { ...r, oem };
        const list = byOem.get(oem) ?? [];
        list.push(copy);
        byOem.set(oem, list);
      }
    }
    processed++;
    if (processed % 200 === 0) console.log(`  … ${processed} images`);
  };

  if (Number.isFinite(maxImages)) {
    for (const j of jobs) {
      if (processed >= maxImages) break;
      await runOne(j);
    }
  } else {
    for (let i = 0; i < jobs.length; i += concurrency) {
      const chunk = jobs.slice(i, i + concurrency);
      await Promise.all(chunk.map((j) => runOne(j)));
    }
  }

  if (dry) {
    console.log(`Dry-run: processed ${processed} images; skip writing labels and imports`);
    return;
  }

  const outDir = join(repoRoot(), "data/sources/autocolorlibrary/labels/tesseract-batch");
  mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  for (const [oem, recs] of byOem) {
    if (recs.length === 0) continue;
    const dedup = new Map<string, AclLabelRecord>();
    for (const r of recs) {
      const code = r.code.split("/")[0]!.trim().toUpperCase().replace(/^#/, "");
      const k = `${r.modelYear}:${code}`;
      dedup.set(k, r);
    }
    const finalList = [...dedup.values()].sort(
      (a, b) => a.modelYear - b.modelYear || a.code.localeCompare(b.code)
    );
    const fn = join(outDir, `${scopeSlug(oem)}.json`);
    writeFileSync(fn, JSON.stringify(finalList, null, 2) + "\n");
    console.log(`Wrote ${finalList.length} labels → ${fn}`);
    written.push(fn);
  }

  const doImport = args["import"] === "true";
  if (doImport) {
    for (const fn of written) {
      console.log(`Importing ${fn}…`);
      execFileSync("npx", ["tsx", "scripts/import-autocolorlibrary-labels.ts", "--in", fn], {
        cwd: repoRoot(),
        stdio: "inherit"
      });
    }
  } else {
    console.log(
      `\nNext: npx tsx scripts/import-autocolorlibrary-labels.ts --in <file> for each JSON in ${outDir}, or re-run with --import true`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
