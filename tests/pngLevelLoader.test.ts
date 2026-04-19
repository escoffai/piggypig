import { describe, expect, it } from 'vitest';
import { cubesFromImage, type PixelImage } from '../src/loaders/pngLevelLoader';

function px(hex: string, alpha = 255) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    alpha,
  ];
}

function buildImage(grid: string[][], map: Record<string, string>): PixelImage {
  const height = grid.length;
  const width = grid[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const g = grid[y][x];
      const hex = map[g];
      const [r, gr, b, a] = hex ? px(hex) : [0, 0, 0, 0];
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = gr;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width, height, data };
}

describe('pngLevelLoader.cubesFromImage', () => {
  it('maps each non-transparent pixel to a cube via palette', () => {
    const img = buildImage(
      [
        ['R', '.', 'G'],
        ['.', 'R', '.'],
      ],
      { R: '#e74c3c', G: '#2ecc71', '.': '' },
    );
    const cubes = cubesFromImage(img, { '#e74c3c': 'red', '#2ecc71': 'green' });
    expect(cubes).toHaveLength(3);
    expect(cubes.find((c) => c.gridX === 0 && c.gridY === 0)?.color).toBe('red');
    expect(cubes.find((c) => c.gridX === 2 && c.gridY === 0)?.color).toBe('green');
    expect(cubes.find((c) => c.gridX === 1 && c.gridY === 1)?.color).toBe('red');
  });

  it('ignores fully-transparent pixels', () => {
    const img = buildImage([['.']], { '.': '' });
    expect(cubesFromImage(img, {})).toEqual([]);
  });
});
