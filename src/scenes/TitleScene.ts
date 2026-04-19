// TitleScene: a minimal level picker — tap a row to launch the level.

import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config';
import { isLevelUnlocked, loadProgress } from '../systems/Progress';
import type { LevelManifestEntry } from './BootScene';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const manifest = this.registry.get('levelManifest') as LevelManifestEntry[];
    this.cameras.main.setBackgroundColor('#0b1120');

    this.add
      .text(LOGICAL_WIDTH / 2, 120, 'PIXEL FLOW', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '72px',
        color: '#fefefe',
      })
      .setOrigin(0.5);

    this.add
      .text(LOGICAL_WIDTH / 2, 190, 'tap a level', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const rowH = 110;
    const startY = 280;
    const progress = loadProgress();
    const manifestIds = manifest.map((m) => m.id);
    manifest.forEach((entry, i) => {
      const y = startY + i * (rowH + 14);
      const unlocked = isLevelUnlocked(manifestIds, entry.id, progress);
      const cleared = progress.levels[entry.id]?.cleared ?? false;
      const stars = progress.levels[entry.id]?.stars ?? 0;

      const bg = this.add.rectangle(LOGICAL_WIDTH / 2, y, LOGICAL_WIDTH - 120, rowH, 0x1e293b);
      bg.setStrokeStyle(3, unlocked ? (cleared ? 0x2ecc71 : 0x3498db) : 0x334155, unlocked ? 0.6 : 0.35);
      const t = this.add
        .text(LOGICAL_WIDTH / 2 - 60, y, entry.title, {
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: '36px',
          color: unlocked ? '#fefefe' : '#475569',
        })
        .setOrigin(0.5);

      if (unlocked) {
        const starStr = '★'.repeat(stars).padEnd(3, '☆');
        this.add
          .text(LOGICAL_WIDTH / 2 + 180, y, starStr, {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '30px',
            color: stars > 0 ? '#f1c40f' : '#475569',
          })
          .setOrigin(0.5);
      } else {
        this.add
          .text(LOGICAL_WIDTH / 2 + 180, y, '🔒', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '32px',
          })
          .setOrigin(0.5);
      }

      if (unlocked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          this.tweens.add({
            targets: [bg, t],
            scale: 0.96,
            duration: 60,
            yoyo: true,
            onComplete: () => {
              this.scene.start('LevelScene', { levelId: entry.id });
            },
          });
        });
      }
    });

    this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 60, 'v1 · single-tap puzzle', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#64748b',
      })
      .setOrigin(0.5);
  }
}
