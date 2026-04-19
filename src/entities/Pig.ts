// Pig render adapter: rounded body, ears, snout, ammo numeral.
// Pure rendering; domain state lives on the Pig data object.

import Phaser from 'phaser';
import { COLOR_HEX } from '../config';
import type { Pig } from '../types';

export class PigSprite {
  public readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly earL: Phaser.GameObjects.Triangle;
  private readonly earR: Phaser.GameObjects.Triangle;
  private readonly snout: Phaser.GameObjects.Ellipse;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    public pig: Pig,
    public size = 52,
  ) {
    const color = COLOR_HEX[pig.color];
    const s = size;
    this.container = scene.add.container(pig.x, pig.y);
    this.body = scene.add.rectangle(0, 0, s, s, color).setStrokeStyle(2, 0x000000, 0.5);
    this.earL = scene.add.triangle(-s * 0.32, -s * 0.55, 0, 0, s * 0.2, 0, s * 0.1, -s * 0.2, color);
    this.earR = scene.add.triangle(s * 0.32, -s * 0.55, 0, 0, s * 0.2, 0, s * 0.1, -s * 0.2, color);
    this.earL.setStrokeStyle(1.5, 0x000000, 0.5);
    this.earR.setStrokeStyle(1.5, 0x000000, 0.5);
    this.snout = scene.add.ellipse(0, s * 0.18, s * 0.36, s * 0.24, 0x000000, 0.25);
    this.label = scene.add
      .text(0, 0, String(pig.ammo), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: `${Math.floor(s * 0.55)}px`,
        color: '#000',
      })
      .setOrigin(0.5);
    this.container.add([this.body, this.earL, this.earR, this.snout, this.label]);
  }

  update(): void {
    this.container.setPosition(this.pig.x, this.pig.y);
    this.label.setText(String(this.pig.ammo));
  }

  destroy(scene: Phaser.Scene, withPuff = false): void {
    if (withPuff) {
      scene.tweens.add({
        targets: this.container,
        scale: 0.1,
        alpha: 0,
        duration: 200,
        ease: 'Quad.easeIn',
        onComplete: () => this.container.destroy(true),
      });
      return;
    }
    this.container.destroy(true);
  }
}
