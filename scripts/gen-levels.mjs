// Generates level PNGs from ASCII grids. Palette-driven; each glyph → hex color.
// Run with: node scripts/gen-levels.mjs
//
// This is an authoring helper. The shipped PNGs are committed so the game does
// not require Node to build. Re-run this script after editing LEVELS[].

import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'levels');

const GLYPH_TO_HEX = {
  R: '#e74c3c',
  B: '#3498db',
  G: '#2ecc71',
  Y: '#f1c40f',
  P: '#e91e63',
  U: '#9b59b6', // purple
  O: '#e67e22',
  W: '#fefefe',
  K: '#111111',
  '.': 'transparent',
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function writePng(path, grid) {
  const rows = grid;
  const height = rows.length;
  const width = rows[0].length;
  const png = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const glyph = row[x];
      const idx = (y * width + x) * 4;
      const hex = GLYPH_TO_HEX[glyph] ?? 'transparent';
      if (hex === 'transparent') {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      } else {
        const { r, g, b } = hexToRgb(hex);
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      }
    }
  }
  const buf = PNG.sync.write(png);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  console.log(`wrote ${path} (${width}x${height})`);
}

// Each level's pixel-art grid. Leading/trailing whitespace on rows is ignored.
const LEVELS = [
  {
    id: 'level-01',
    grid: ['GGGG', 'GGGG', 'GGGG', 'GGGG'],
  },
  {
    id: 'level-02',
    grid: [
      '.YYYY.',
      '.YYYY.',
      '.GGGG.',
      'PGGGGP',
      '.GGGG.',
      '.GGGG.',
    ],
  },
  {
    id: 'level-03',
    // Heart, 7 cols x 6 rows.
    grid: [
      '.RR.RR.',
      'RRRRRRR',
      'RRRRRRR',
      '.RRRRR.',
      '..RRR..',
      '...R...',
    ],
  },
  {
    id: 'level-04',
    // Flag stripes: 4 rows x 10 cols.
    grid: [
      'WWWWWWWWWW',
      'WWWWWWWWWW',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
    ],
  },
  {
    id: 'level-05',
    // Diamond gem, 7x7, blue outer, yellow inner, pink center.
    grid: [
      '...B...',
      '..BBB..',
      '.BBYBB.',
      'BBYPYBB',
      '.BBYBB.',
      '..BBB..',
      '...B...',
    ],
  },
];

for (const lvl of LEVELS) {
  writePng(resolve(OUT_DIR, `${lvl.id}.png`), lvl.grid);
}
