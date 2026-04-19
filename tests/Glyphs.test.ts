import { describe, expect, it } from 'vitest';
import { GLYPH_FOR_COLOR, glyphContrast } from '../src/systems/Glyphs';
import type { Color } from '../src/types';

const ALL_COLORS: Color[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'pink',
  'purple',
  'orange',
  'white',
  'black',
];

describe('Glyphs', () => {
  it('assigns a distinct glyph kind to every palette color', () => {
    const seen = new Set<string>();
    for (const c of ALL_COLORS) {
      const glyph = GLYPH_FOR_COLOR[c];
      expect(glyph).toBeTruthy();
      seen.add(glyph);
    }
    expect(seen.size).toBe(ALL_COLORS.length);
  });

  it('contrast color is legible against each cube hue', () => {
    // light-bg family gets a dark contrast (0x0b1120); others get white (0xfefefe).
    expect(glyphContrast('yellow')).toBe(0x0b1120);
    expect(glyphContrast('white')).toBe(0x0b1120);
    expect(glyphContrast('pink')).toBe(0x0b1120);
    expect(glyphContrast('red')).toBe(0xfefefe);
    expect(glyphContrast('blue')).toBe(0xfefefe);
    expect(glyphContrast('black')).toBe(0xfefefe);
  });
});
