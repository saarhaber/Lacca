/**
 * One-off helper: find a fixed-size window whose mean RGB best matches PaintRef hex
 * for a set of BMW codes (2019 sheet). Writes pilot label JSON for acl-pilot-validate.
 *
 *   tsx scripts/acl-build-pilot-labels.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function d2(a: number, b: number): number {
  return (a - b) * (a - b);
}

const REF: Array<{ code: string; name: string; hex: string; finish: string }> = [
  { code: "300", name: "Alpine White", hex: "#D9DED3", finish: "solid" },
  { code: "416", name: "Carbon Black", hex: "#1A1412", finish: "pearl" },
  { code: "475", name: "Black Sapphire", hex: "#1D2125", finish: "pearl" },
  { code: "668", name: "Jet Black", hex: "#000000", finish: "solid" },
  { code: "A75", name: "Melbourne Red", hex: "#CC2504", finish: "solid" }
];

const WIN = 100;
const IMG = "data/sources/autocolorlibrary/pages/2019-bmw/2019_BMW_01.jpg";

async function main() {
  const buf = readFileSync(join(repoRoot(), IMG));
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width!;
  const H = info.height!;
  const ch = info.channels!;

  const labels: unknown[] = [];

  for (const row of REF) {
    const [tr, tg, tb] = hexToRgb(row.hex);
    let best = { score: 1e12, x: 0, y: 0, r: 0, g: 0, b: 0 };
    const coarse = 14;
    for (let y = 450; y < H - 450; y += coarse) {
      for (let x = 0; x < W - WIN; x += coarse) {
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let dy = 0; dy < WIN; dy++) {
          for (let dx = 0; dx < WIN; dx++) {
            const i = ((y + dy) * W + (x + dx)) * ch;
            r += data[i]!;
            g += data[i + 1]!;
            b += data[i + 2]!;
            n++;
          }
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const score = d2(r, tr) + d2(g, tg) + d2(b, tb);
        if (score < best.score) best = { score, x, y, r, g, b };
      }
    }
    const refineR = 28;
    for (let y = best.y - refineR; y <= best.y + refineR; y += 2) {
      for (let x = best.x - refineR; x <= best.x + refineR; x += 2) {
        if (y < 0 || x < 0 || y + WIN > H || x + WIN > W) continue;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let dy = 0; dy < WIN; dy++) {
          for (let dx = 0; dx < WIN; dx++) {
            const i = ((y + dy) * W + (x + dx)) * ch;
            r += data[i]!;
            g += data[i + 1]!;
            b += data[i + 2]!;
            n++;
          }
        }
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const score = d2(r, tr) + d2(g, tg) + d2(b, tb);
        if (score < best.score) best = { score, x, y, r, g, b };
      }
    }
    const hex =
      "#" +
      [best.r, best.g, best.b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    labels.push({
      oem: "BMW",
      modelYear: 2019,
      sourcePageUrl: "https://www.autocolorlibrary.com/pages/2019-Bmw.html",
      imageFile: IMG,
      bbox: { x: best.x, y: best.y, w: WIN, h: WIN },
      hex,
      code: row.code,
      marketingName: row.name,
      finish: row.finish,
      notes: `Pilot: window chosen to minimize RGB distance to PaintRef hex ${row.hex} (automated placement).`
    });
    console.log(row.code, hex, "bbox", best.x, best.y, "score", best.score);
  }

  const out = join(repoRoot(), "data/sources/autocolorlibrary/pilot-labels-bmw-2019.json");
  writeFileSync(out, JSON.stringify(labels, null, 2) + "\n");
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
