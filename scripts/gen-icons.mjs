// Generates PWA icons as solid-color PNG squares with a centered "pig" glyph:
// a rounded pink square with two triangle ears and a dark snout oval.
// Deterministic; re-run after editing sizes.

import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public');

const BG = [11, 17, 32, 255]; // slate-navy
const PIG = [233, 30, 99, 255]; // pink
const SHADOW = [0, 0, 0, 64];

function inRoundRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > w / 2 || dy > h / 2) return false;
  if (dx <= w / 2 - r || dy <= h / 2 - r) return true;
  const cornerX = dx - (w / 2 - r);
  const cornerY = dy - (h / 2 - r);
  return cornerX * cornerX + cornerY * cornerY <= r * r;
}

function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const s = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const t = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  if (s * t < 0) return false;
  const u = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  return (s === 0 || s * u >= 0) && (t === 0 || t * u >= 0);
}

function inEllipse(x, y, cx, cy, rx, ry) {
  const a = (x - cx) / rx;
  const b = (y - cy) / ry;
  return a * a + b * b <= 1;
}

function writeIcon(size, pathOut) {
  const png = new PNG({ width: size, height: size, colorType: 6 });
  const bodyCx = size / 2;
  const bodyCy = size / 2 + size * 0.03;
  const bodyW = size * 0.66;
  const bodyH = size * 0.66;
  const bodyR = size * 0.14;
  const earL = {
    ax: bodyCx - bodyW * 0.42,
    ay: bodyCy - bodyH * 0.52,
    bx: bodyCx - bodyW * 0.15,
    by: bodyCy - bodyH * 0.52,
    cx: bodyCx - bodyW * 0.28,
    cy: bodyCy - bodyH * 0.85,
  };
  const earR = {
    ax: bodyCx + bodyW * 0.42,
    ay: bodyCy - bodyH * 0.52,
    bx: bodyCx + bodyW * 0.15,
    by: bodyCy - bodyH * 0.52,
    cx: bodyCx + bodyW * 0.28,
    cy: bodyCy - bodyH * 0.85,
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let pixel = BG;
      if (
        inRoundRect(x, y, bodyCx, bodyCy, bodyW, bodyH, bodyR) ||
        inTriangle(x, y, earL.ax, earL.ay, earL.bx, earL.by, earL.cx, earL.cy) ||
        inTriangle(x, y, earR.ax, earR.ay, earR.bx, earR.by, earR.cx, earR.cy)
      ) {
        pixel = PIG;
      }
      if (inEllipse(x, y, bodyCx, bodyCy + bodyH * 0.12, bodyW * 0.18, bodyH * 0.1)) {
        // snout
        pixel = [...SHADOW.slice(0, 3), 200];
      }
      png.data[i] = pixel[0];
      png.data[i + 1] = pixel[1];
      png.data[i + 2] = pixel[2];
      png.data[i + 3] = pixel[3];
    }
  }
  const buf = PNG.sync.write(png);
  mkdirSync(dirname(pathOut), { recursive: true });
  writeFileSync(pathOut, buf);
  console.log(`wrote ${pathOut} (${size}x${size})`);
}

writeIcon(192, resolve(OUT_DIR, 'icon-192.png'));
writeIcon(512, resolve(OUT_DIR, 'icon-512.png'));
writeIcon(180, resolve(OUT_DIR, 'apple-touch-icon.png'));
writeIcon(32, resolve(OUT_DIR, 'favicon-32.png'));
