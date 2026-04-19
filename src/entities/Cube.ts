// Cube render adapter: a colored square Graphics object anchored at a grid cell.

import Phaser from 'phaser';
import { COLOR_HEX } from '../config';
import type { BoardConfig, Cube } from '../types';

export class CubeSprite {
  public readonly gfx: Phaser.GameObjects.Rectangle;
  public readonly border: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, public cube: Cube, board: BoardConfig) {
    const size = board.cellSize;
    const x = board.originX + cube.gridX * size + size / 2;
    const y = board.originY + cube.gridY * size + size / 2;
    // subtle border ring for pixel definition
    this.border = scene.add.rectangle(x, y, size + 1, size + 1, 0x000000, 0.25);
    this.gfx = scene.add.rectangle(x, y, size - 2, size - 2, COLOR_HEX[cube.color]);
    this.gfx.setStrokeStyle(1, 0x000000, 0.4);
  }

  destroy(): void {
    this.gfx.destroy();
    this.border.destroy();
  }

  pop(scene: Phaser.Scene, onDone?: () => void): void {
    scene.tweens.add({
      targets: [this.gfx, this.border],
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
