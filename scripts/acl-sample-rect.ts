/**
 * Debug: average sRGB inside a rectangle of a JPEG/PNG (matches acl-labeler logic).
 *
 * Usage:
 *   tsx scripts/acl-sample-rect.ts path/to.jpg x y w h
 */

import { readFileSync } from "node:fs";
import sharp from "sharp";

const [path, xs, ys, ws, hs] = process.argv.slice(2);
if (!path || !xs || !ys || !ws || !hs) {
  console.error("Usage: tsx scripts/acl-sample-rect.ts <image> x y w h");
  process.exit(1);
}
const x = parseInt(xs, 10);
const y = parseInt(ys, 10);
const w = parseInt(ws, 10);
const h = parseInt(hs, 10);

const buf = readFileSync(path);
const { data, info } = await sharp(buf)
  .extract({ left: x, top: y, width: w, height: h })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const ch = info.channels;
let r = 0,
  g = 0,
  b = 0,
  n = 0;
for (let i = 0; i < data.length; i += ch) {
  const a = ch === 4 ? data[i + 3]! : 255;
  if (a < 8) continue;
  r += data[i]!;
  g += data[i + 1]!;
  b += data[i + 2]!;
  n++;
}
r = Math.round(r / n);
g = Math.round(g / n);
b = Math.round(b / n);
const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
console.log(hex, `rgb(${r},${g},${b})`, `n=${n}`);
