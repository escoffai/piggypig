// Cube render adapter: a colored square Graphics object anchored at a grid cell.

import Phaser from 'phaser';
import { COLOR_HEX } from '../config';
import { drawGlyph } from '../systems/Glyphs';
import { isColorBlind } from '../systems/Progress';
import type { BoardConfig, Cube } from '../types';

export class CubeSprite {
  public readonly gfx: Phaser.GameObjects.Rectangle;
  public readonly border: Phaser.GameObjects.Rectangle;
  public readonly glyphs: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, public cube: Cube, board: BoardConfig) {
    const size = board.cellSize;
    const x = board.originX + cube.gridX * size + size / 2;
    const y = board.originY + cube.gridY * size + size / 2;
    // subtle border ring for pixel definition
    this.border = scene.add.rectangle(x, y, size + 1, size + 1, 0x000000, 0.25);
    this.gfx = scene.add.rectangle(x, y, size - 2, size - 2, COLOR_HEX[cube.color]);
    this.gfx.setStrokeStyle(1, 0x000000, 0.4);
    if (isColorBlind()) {
      this.glyphs = drawGlyph(scene, cube.color, x, y, size);
    }
  }

  destroy(): void {
    this.gfx.destroy();
    this.border.destroy();
    for (const g of this.glyphs) g.destroy();
    this.glyphs.length = 0;
  }

  refreshGlyphs(scene: Phaser.Scene, board: BoardConfig): void {
    for (const g of this.glyphs) g.destroy();
    this.glyphs.length = 0;
    if (!isColorBlind()) return;
    const size = board.cellSize;
    const x = board.originX + this.cube.gridX * size + size / 2;
    const y = board.originY + this.cube.gridY * size + size / 2;
    const glyphs = drawGlyph(scene, this.cube.color, x, y, size);
    this.glyphs.push(...glyphs);
  }

  pop(scene: Phaser.Scene, onDone?: () => void): void {
    const targets = [this.gfx, this.border, ...this.glyphs];
    scene.tweens.add({
      targets,
      scale: 1.35,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
        onDone?.();
      },
    });
  }
}
