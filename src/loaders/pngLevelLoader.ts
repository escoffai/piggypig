// PNG level loader: decode a PNG (browser: via canvas ImageData; Node: via pngjs)
// and map each non-transparent pixel to a cube using the level's palette.

import type { Color, Cube } from '../types';

export interface PixelImage {
  width: number;
  height: number;
  // Flat RGBA8 array, length = width * height * 4.
  data: Uint8ClampedArray | Uint8Array;
}

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase().replace('#', '');
}

function rgbaToHex(r: number, g: number, b: number): string {
  return (
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  ).toLowerCase();
}

export function cubesFromImage(img: PixelImage, palette: Record<string, Color>): Cube[] {
  const normalized: Record<string, Color> = {};
  for (const [k, v] of Object.entries(palette)) {
    normalized[normalizeHex(k)] = v;
  }
  const cubes: Cube[] = [];
  const { width, height, data } = img;
  let seq = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 8) continue; // fully-or-nearly transparent → no cube
      const hex = rgbaToHex(r, g, b);
      const color = normalized[hex];
      if (!color) {
        // Unknown palette entry: skip rather than crash, but emit a warning in dev.
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn(`pngLevelLoader: unmapped color #${hex} at (${x},${y})`);
        }
        continue;
      }
      cubes.push({
        id: `cube-${seq++}`,
        color,
        gridX: x,
        gridY: y,
        hp: 1,
      });
    }
  }
  return cubes;
}

// Browser-side helper: take a loaded HTMLImageElement or ImageBitmap and extract pixels.
export async function pixelImageFromImage(src: HTMLImageElement | ImageBitmap): Promise<PixelImage> {
  const canvas = document.createElement('canvas');
  canvas.width = 'width' in src ? src.width : (src as HTMLImageElement).naturalWidth;
  canvas.height = 'height' in src ? src.height : (src as HTMLImageElement).naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx.drawImage(src as any, 0, 0);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: id.width, height: id.height, data: id.data };
}

export async function pixelImageFromUrl(url: string): Promise<PixelImage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load image ${url}`));
    el.src = url;
  });
  return pixelImageFromImage(img);
}
