/**
 * Chip-image sampler for PaintRef.
 *
 * PaintRef renders most paint swatches as small PNG chips served under
 * `https://www.paintref.com/chipimages/…`. Our parser
 * ([scripts/lib/paintref.ts](./paintref.ts)) captures the chip URL on every
 * parsed row; this module downloads each unique chip once, caches the raw
 * bytes on disk, center-crops to defeat border/shadow artifacts, averages
 * the non-transparent pixels, and returns a deterministic hex + pixel count.
 *
 * Design goals:
 *   1. Deterministic and offline-replayable — the raw chip bytes live at
 *      `data/sources/paintref/chipimages/<chipHash>.png` forever; once
 *      downloaded, re-sampling never hits the network.
 *   2. Separation of concerns — parsing HTML, fetching chips, and averaging
 *      pixels are three independent stages so any one can be replayed
 *      (e.g. tweak the crop window) without redoing the others.
 *   3. Honest quality gates — we reject chips that are too small, too
 *      variegated (multi-color logos/banners), or that average to obvious
 *      decorative backgrounds (#FFFFFF, #000000, table greys).
 *
 * Entry point: {@link sampleChip}.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
// Side-effect import: shares the long-timeout undici dispatcher with paintref.ts.
import "./httpDispatcher.js";

export interface SampleChipOptions {
  /** Override the chip-cache directory (default: `<repo>/data/sources/paintref/chipimages`). */
  cacheDir?: string;
  /**
   * Force a re-download even if the chip already lives on disk. The sampler
   * itself always re-computes the average from the cached bytes, so this is
   * only needed when PaintRef changes the image at the same URL.
   */
  forceRefresh?: boolean;
  /**
   * Center-crop fraction (0 < crop ≤ 1). Default 0.6 — a 60%×60% middle
   * window defeats the 1-2 px borders PaintRef sometimes adds without
   * throwing away enough pixels to matter for the average.
   */
  cropFraction?: number;
  /** Minimum usable pixels in the crop after alpha masking. Default 200. */
  minPixels?: number;
  /** Maximum stdDev per channel (0-255). Chips above this are likely multi-color logos. Default 35. */
  maxChannelStdDev?: number;
  /** Max total download/retry attempts per chip. Default 3. */
  maxAttempts?: number;
}

export interface ChipSample {
  /** `#RRGGBB` — channel-averaged, clamped to 8-bit. */
  hex: string;
  rgb: [number, number, number];
  /** Standard deviation per R/G/B channel across the cropped pixels. */
  stdDev: [number, number, number];
  /** Number of non-transparent pixels averaged. */
  pixels: number;
  /** 16-char `sha1(url)` prefix — the on-disk cache key. */
  chipHash: string;
  /** Absolute path of the cached PNG. */
  cachePath: string;
  /** Original chip URL the sample came from. */
  url: string;
}

export class ChipSampleError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly reason:
      | "fetch-failed"
      | "decode-failed"
      | "too-few-pixels"
      | "too-variegated"
      | "decorative-background"
  ) {
    super(message);
    this.name = "ChipSampleError";
  }
}

const DEFAULT_OPTIONS: Required<Omit<SampleChipOptions, "cacheDir">> = {
  forceRefresh: false,
  cropFraction: 0.6,
  minPixels: 200,
  maxChannelStdDev: 35,
  maxAttempts: 3
};

// Decorative backgrounds we never want a chip to average out to. These are
// PaintRef's table greys + fully white/black, which nearly always indicate a
// placeholder image rather than an actual paint swatch.
const DECORATIVE_HEXES = new Set([
  "#FFFFFF",
  "#FEFEFE",
  "#000000",
  "#E0E0E0",
  "#F0F0F0"
]);

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function defaultCacheDir(): string {
  return join(repoRoot(), "data/sources/paintref/chipimages");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 16-char `sha1(url)` prefix — mirrored in `scripts/lib/paintref.ts#chipHashOf`. */
export function chipHashOf(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

async function downloadChip(url: string, maxAttempts: number): Promise<Buffer> {
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "image/png,image/gif,image/*;q=0.9,*/*;q=0.5",
          "User-Agent": "Mozilla/5.0 (compatible; lacca-color-pipeline/1.0)"
        }
      });
      if (res.status === 429 || res.status === 503 || res.status === 508) {
        lastErr = `${res.status} ${res.statusText}`;
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        lastErr = `${res.status} ${res.statusText}`;
        break;
      }
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.byteLength === 0) {
        lastErr = "empty body";
        continue;
      }
      return buf;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new ChipSampleError(
    `download failed after ${maxAttempts} attempts: ${lastErr ?? "unknown"}`,
    url,
    "fetch-failed"
  );
}

interface RawImage {
  data: Buffer;
  info: { width: number; height: number; channels: number };
}

async function decodeRaw(buf: Buffer, url: string): Promise<RawImage> {
  try {
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, info };
  } catch (err) {
    throw new ChipSampleError(
      `sharp decode failed: ${err instanceof Error ? err.message : String(err)}`,
      url,
      "decode-failed"
    );
  }
}

interface AverageResult {
  rgb: [number, number, number];
  stdDev: [number, number, number];
  pixels: number;
}

function centerCropAverage(
  img: RawImage,
  cropFraction: number
): AverageResult {
  const { data, info } = img;
  const { width: W, height: H, channels } = info;
  const f = Math.min(1, Math.max(0.1, cropFraction));
  const cropW = Math.max(1, Math.round(W * f));
  const cropH = Math.max(1, Math.round(H * f));
  const x0 = Math.floor((W - cropW) / 2);
  const y0 = Math.floor((H - cropH) / 2);

  let r = 0, g = 0, b = 0, n = 0;
  let r2 = 0, g2 = 0, b2 = 0;

  for (let y = y0; y < y0 + cropH; y++) {
    for (let x = x0; x < x0 + cropW; x++) {
      const i = (y * W + x) * channels;
      const alpha = channels >= 4 ? data[i + 3] : 255;
      if (alpha < 128) continue;
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      r += R; g += G; b += B;
      r2 += R * R; g2 += G * G; b2 += B * B;
      n++;
    }
  }

  if (n === 0) {
    return { rgb: [0, 0, 0], stdDev: [0, 0, 0], pixels: 0 };
  }

  const mR = r / n, mG = g / n, mB = b / n;
  const vR = Math.max(0, r2 / n - mR * mR);
  const vG = Math.max(0, g2 / n - mG * mG);
  const vB = Math.max(0, b2 / n - mB * mB);

  return {
    rgb: [mR, mG, mB],
    stdDev: [Math.sqrt(vR), Math.sqrt(vG), Math.sqrt(vB)],
    pixels: n
  };
}

function applyQualityGates(
  avg: AverageResult,
  hex: string,
  opts: Required<Omit<SampleChipOptions, "cacheDir">>,
  url: string
): void {
  if (avg.pixels < opts.minPixels) {
    throw new ChipSampleError(
      `only ${avg.pixels} usable pixels (< ${opts.minPixels})`,
      url,
      "too-few-pixels"
    );
  }
  const maxSd = Math.max(...avg.stdDev);
  if (maxSd > opts.maxChannelStdDev) {
    throw new ChipSampleError(
      `max channel stdDev ${maxSd.toFixed(1)} > ${opts.maxChannelStdDev} — likely a multi-color image`,
      url,
      "too-variegated"
    );
  }
  if (DECORATIVE_HEXES.has(hex)) {
    throw new ChipSampleError(
      `averaged to decorative background ${hex}`,
      url,
      "decorative-background"
    );
  }
}

/**
 * Download (or re-read from cache) the chip at `url`, center-crop, and
 * return its average color. Throws {@link ChipSampleError} when the chip
 * fails a quality gate so the caller can log + continue rather than crash
 * the whole batch.
 */
export async function sampleChip(
  url: string,
  opts: SampleChipOptions = {}
): Promise<ChipSample> {
  const settings = { ...DEFAULT_OPTIONS, ...opts };
  const cacheDir = opts.cacheDir ?? defaultCacheDir();
  mkdirSync(cacheDir, { recursive: true });

  const hash = chipHashOf(url);
  const cachePath = join(cacheDir, `${hash}.png`);

  let bytes: Buffer;
  if (!settings.forceRefresh && existsSync(cachePath)) {
    bytes = readFileSync(cachePath);
  } else {
    bytes = await downloadChip(url, settings.maxAttempts);
    writeFileSync(cachePath, bytes);
  }

  const img = await decodeRaw(bytes, url);
  const avg = centerCropAverage(img, settings.cropFraction);
  const hex = `#${toHex(avg.rgb[0])}${toHex(avg.rgb[1])}${toHex(avg.rgb[2])}`;
  applyQualityGates(avg, hex, settings, url);

  return {
    hex,
    rgb: [
      Math.round(avg.rgb[0]),
      Math.round(avg.rgb[1]),
      Math.round(avg.rgb[2])
    ],
    stdDev: [
      Math.round(avg.stdDev[0] * 100) / 100,
      Math.round(avg.stdDev[1] * 100) / 100,
      Math.round(avg.stdDev[2] * 100) / 100
    ],
    pixels: avg.pixels,
    chipHash: hash,
    cachePath,
    url
  };
}

/* ----------------------------- Sample store ----------------------------- */

/**
 * Persisted sampler output keyed by `chipHash`. Callers write one file per
 * OEM slug under `data/sources/paintref/chips/<slug>.json` so re-deriving
 * LAB is a pure-local operation — no HTML re-parse, no network.
 */
export interface ChipSampleRecord {
  hex: string;
  rgb: [number, number, number];
  pixels: number;
  stdDev: [number, number, number];
  url: string;
  sampledAt: string;
}

export type ChipSampleStore = Record<string, ChipSampleRecord>;

export function loadChipSampleStore(path: string): ChipSampleStore {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ChipSampleStore;
  } catch {
    return {};
  }
}

export function saveChipSampleStore(path: string, store: ChipSampleStore): void {
  mkdirSync(dirname(path), { recursive: true });
  const ordered = Object.fromEntries(
    Object.entries(store).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(path, JSON.stringify(ordered, null, 2) + "\n");
}

export function recordFromSample(sample: ChipSample): ChipSampleRecord {
  return {
    hex: sample.hex,
    rgb: sample.rgb,
    pixels: sample.pixels,
    stdDev: sample.stdDev,
    url: sample.url,
    sampledAt: new Date().toISOString()
  };
}
