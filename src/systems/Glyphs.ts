// Per-color glyph shapes for color-blind accessibility. Each color maps to
// a distinct geometric shape drawn as a small overlay; hue becomes a secondary
// signal. The glyph's stroke/fill uses a black/white contrast color so it
// reads against any cube hue.

import Phaser from 'phaser';
import type { Color } from '../types';

export type GlyphKind =
  | 'circle'
  | 'square'
  | 'triangleUp'
  | 'diamond'
  | 'plus'
  | 'cross'
  | 'triangleDown'
  | 'ring'
  | 'bar';

export const GLYPH_FOR_COLOR: Record<Color, GlyphKind> = {
  red: 'circle',
  blue: 'square',
  green: 'triangleUp',
  yellow: 'diamond',
  pink: 'plus',
  purple: 'cross',
  orange: 'triangleDown',
  white: 'ring',
  black: 'bar',
};

// Colors that render better with a white glyph (dark-cube families) vs. a black
// glyph (light-cube families).
const LIGHT_BG_COLORS = new Set<Color>(['yellow', 'white', 'pink']);

export function glyphContrast(color: Color): number {
  return LIGHT_BG_COLORS.has(color) ? 0x0b1120 : 0xfefefe;
}

// Draws a glyph for `color` centered at (x, y) inside a cell of size `size`.
// Returns the created GameObjects so callers can attach/destroy them.
export function drawGlyph(
  scene: Phaser.Scene,
  color: Color,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.GameObject[] {
  const kind = GLYPH_FOR_COLOR[color];
  const c = glyphContrast(color);
  const s = size * 0.42; // glyph bounding box, relative to the cell
  const t = Math.max(2, Math.round(size * 0.09)); // stroke thickness
  const objs: Phaser.GameObjects.GameObject[] = [];

  switch (kind) {
    case 'circle': {
      const g = scene.add.circle(x, y, s * 0.55, c);
      objs.push(g);
      break;
    }
    case 'square': {
      const g = scene.add.rectangle(x, y, s, s, c);
      objs.push(g);
      break;
    }
    case 'triangleUp': {
      const g = scene.add.triangle(x, y, 0, s * 0.6, s * 0.7, -s * 0.55, -s * 0.7, -s * 0.55, c);
      objs.push(g);
      break;
    }
    case 'triangleDown': {
      const g = scene.add.triangle(x, y, 0, -s * 0.6, s * 0.7, s * 0.55, -s * 0.7, s * 0.55, c);
      objs.push(g);
      break;
    }
    case 'diamond': {
      const g = scene.add.rectangle(x, y, s * 0.85, s * 0.85, c);
      g.setAngle(45);
      objs.push(g);
      break;
    }
    case 'plus': {
      const h = scene.add.rectangle(x, y, s, t, c);
      const v = scene.add.rectangle(x, y, t, s, c);
      objs.push(h, v);
      break;
    }
    case 'cross': {
      const a = scene.add.rectangle(x, y, s, t, c);
      a.setAngle(45);
      const b = scene.add.rectangle(x, y, s, t, c);
      b.setAngle(-45);
      objs.push(a, b);
      break;
    }
    case 'ring': {
      const g = scene.add.circle(x, y, s * 0.5, 0x000000, 0);
      g.setStrokeStyle(t, c, 1);
      objs.push(g);
      break;
    }
    case 'bar': {
      const g = scene.add.rectangle(x, y, s, t * 1.3, c);
      objs.push(g);
      break;
    }
  }
  for (const o of objs) {
    // Above the cube body, below UI overlays.
    (o as Phaser.GameObjects.Shape).setDepth(1);
  }
  return objs;
}
