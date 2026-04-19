// LevelScene: renders board, belt, pigs, cubes. Drives the fixed-step tick.

import Phaser from 'phaser';
import {
  BELT_EDGE_HEX,
  BELT_HEX,
  COLOR_HEX,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  TICK_MS,
} from '../config';
import { CubeSprite } from '../entities/Cube';
import { PigSprite } from '../entities/Pig';
import { buildLevel, initialState, type LevelJson } from '../loaders/levelLoader';
import { pixelImageFromImage } from '../loaders/pngLevelLoader';
import { tickBelt } from '../systems/BeltSystem';
import { deployFromInventory } from '../systems/InventorySystem';
import { recordLevelCleared } from '../systems/Progress';
import { resolveHits } from '../systems/ShootingSystem';
import { parkLoopedPigs, redeployFromSlot } from '../systems/WaitingSlotsSystem';
import { applyOutcome } from '../systems/WinFailSystem';
import {
  haptic,
  sfxCapacityBlocked,
  sfxCubePop,
  sfxFail,
  sfxLevelClear,
  sfxPigPop,
  sfxShot,
  sfxTap,
} from '../systems/SoundSystem';
import type { GameState } from '../types';

export class LevelScene extends Phaser.Scene {
  private state!: GameState;
  private pigSprites = new Map<string, PigSprite>();
  private cubeSprites = new Map<string, CubeSprite>();
  private accumMs = 0;
  private boardBg?: Phaser.GameObjects.Rectangle;
  private levelId = '';

  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#0b1120');
    const json = this.cache.json.get(`${this.levelId}.json`) as LevelJson;
    const tex = this.textures.get(`${this.levelId}.png`);
    const src = tex.getSourceImage() as HTMLImageElement | ImageBitmap;
    const pxImg = await pixelImageFromImage(src);
    const level = buildLevel(json, pxImg);
    this.state = initialState(level);
    this.registry.set('state', this.state);
    this.registry.set('levelId', this.levelId);

    this.drawBelt();
    this.drawBoardFrame();
    this.spawnCubeSprites();

    // Launch UI scene in parallel.
    this.scene.launch('UIScene');

    // Listen to deploy events from UI.
    this.events.on('pf:deploy-inventory', (entryId: string) => this.handleDeployInventory(entryId));
    this.events.on('pf:deploy-slot', (slotIndex: number) => this.handleDeploySlot(slotIndex));
    this.events.on('pf:quit', () => this.handleQuit());
    this.events.on('pf:retry', () => this.handleRetry());
    this.events.on('pf:next', () => this.handleNext());
    this.events.on('pf:colorblind-changed', () => this.refreshCubeGlyphs());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.removeAllListeners('pf:deploy-inventory');
      this.events.removeAllListeners('pf:deploy-slot');
      this.events.removeAllListeners('pf:quit');
      this.events.removeAllListeners('pf:retry');
      this.events.removeAllListeners('pf:next');
      this.events.removeAllListeners('pf:colorblind-changed');
    });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.state) return;
    if (this.state.status !== 'playing') return;

    this.accumMs += Math.min(deltaMs, 100);
    while (this.accumMs >= TICK_MS) {
      this.accumMs -= TICK_MS;
      this.state.time += TICK_MS;

      tickBelt(this.state, TICK_MS);
      const events = resolveHits(this.state, TICK_MS);

      if (events.shots.length > 0) {
        sfxShot();
        haptic(12);
        for (const s of events.shots) {
          this.drawProjectile(s.fromX, s.fromY, s.toX, s.toY, s.color);
          const cubeKey = `${this.findCubeKeyById(s.cubeId)}`;
          if (cubeKey) {
            const cs = this.cubeSprites.get(cubeKey);
            if (cs) {
              this.cubeSprites.delete(cubeKey);
              cs.pop(this);
              sfxCubePop();
            }
          }
        }
      }

      for (const d of events.despawns) {
        const ps = this.pigSprites.get(d.pigId);
        if (ps) {
          this.pigSprites.delete(d.pigId);
          ps.destroy(this, true);
          sfxPigPop();
        }
      }

      const park = parkLoopedPigs(this.state);
      for (const p of park.parked) {
        const ps = this.pigSprites.get(p.pig.id);
        if (ps) {
          this.pigSprites.delete(p.pig.id);
          ps.destroy(this, false);
        }
        (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-park', p.slotIndex, p.pig);
      }

      applyOutcome(this.state);
    }

    // Render: sync all pig sprites.
    for (const pig of this.state.pigs) {
      let sprite = this.pigSprites.get(pig.id);
      if (!sprite) {
        sprite = new PigSprite(this, pig);
        this.pigSprites.set(pig.id, sprite);
      }
      sprite.update();
    }

    // Notify UI of capacity each frame.
    (this.scene.get('UIScene') as Phaser.Scene).events.emit(
      'pf:ui-tick',
      this.state.pigs.length,
      this.state.level.belt.capacity,
    );

    const outcome = this.state.status as string;
    if (outcome === 'won') {
      this.handleWin();
    } else if (outcome === 'lost') {
      this.handleLose();
    }
  }

  // -- Rendering helpers --

  private drawBelt(): void {
    const path = this.state.level.belt.path;
    if (path.length < 2) return;
    const g = this.add.graphics();
    const beltWidth = 64;
    // Thick outer ring
    g.lineStyle(beltWidth, BELT_HEX, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();
    // Thin centerline
    g.lineStyle(2, BELT_EDGE_HEX, 0.9);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    // Chevrons along each segment, pointing in belt direction.
    const chevronSpacing = 42;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / (len || 1);
      const uy = dy / (len || 1);
      const count = Math.floor(len / chevronSpacing);
      for (let k = 1; k < count; k++) {
        const t = k / count;
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;
        this.drawChevron(g, cx, cy, ux, uy);
      }
    }
  }

  private drawChevron(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    ux: number,
    uy: number,
  ): void {
    // Chevron is a V pointing along (ux, uy).
    const size = 9;
    const nx = -uy; // perpendicular
    const ny = ux;
    const tipX = cx + ux * size;
    const tipY = cy + uy * size;
    const leftX = cx - ux * size * 0.2 + nx * size * 0.7;
    const leftY = cy - uy * size * 0.2 + ny * size * 0.7;
    const rightX = cx - ux * size * 0.2 - nx * size * 0.7;
    const rightY = cy - uy * size * 0.2 - ny * size * 0.7;
    g.lineStyle(3, 0xffffff, 0.55);
    g.beginPath();
    g.moveTo(leftX, leftY);
    g.lineTo(tipX, tipY);
    g.lineTo(rightX, rightY);
    g.strokePath();
  }

  private drawBoardFrame(): void {
    const b = this.state.level.board;
    const w = b.cols * b.cellSize;
    const h = b.rows * b.cellSize;
    const cx = b.originX + w / 2;
    const cy = b.originY + h / 2;
    this.boardBg = this.add
      .rectangle(cx, cy, w + 12, h + 12, 0x0f172a, 0.8)
      .setStrokeStyle(2, 0x334155, 0.6);
    this.boardBg.setDepth(-1);
  }

  private spawnCubeSprites(): void {
    const board = this.state.level.board;
    for (const cube of this.state.cubes.values()) {
      const sprite = new CubeSprite(this, cube, board);
      this.cubeSprites.set(`${cube.gridX},${cube.gridY}`, sprite);
    }
  }

  private refreshCubeGlyphs(): void {
    const board = this.state.level.board;
    for (const cs of this.cubeSprites.values()) {
      cs.refreshGlyphs(this, board);
    }
  }

  private drawProjectile(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: keyof typeof COLOR_HEX,
  ): void {
    const line = this.add.line(0, 0, fromX, fromY, toX, toY, COLOR_HEX[color], 1);
    line.setLineWidth(4);
    line.setOrigin(0, 0);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 140,
      onComplete: () => line.destroy(),
    });
    const burst = this.add.circle(toX, toY, 14, COLOR_HEX[color], 0.7);
    this.tweens.add({
      targets: burst,
      scale: 2.2,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => burst.destroy(),
    });
  }

  private findCubeKeyById(cubeId: string): string {
    for (const [k, cs] of this.cubeSprites.entries()) {
      if (cs.cube.id === cubeId) return k;
    }
    return '';
  }

  // -- Input handlers --

  private handleDeployInventory(entryId: string): void {
    sfxTap();
    const result = deployFromInventory(this.state, entryId);
    if (result.reason !== 'ok') {
      if (result.reason === 'capacity') {
        sfxCapacityBlocked();
        (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-blocked');
      }
      return;
    }
    for (const pig of result.deployed) {
      const sprite = new PigSprite(this, pig);
      this.pigSprites.set(pig.id, sprite);
    }
    (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-inventory-changed');
  }

  private handleDeploySlot(slotIndex: number): void {
    sfxTap();
    const r = redeployFromSlot(this.state, slotIndex);
    if (!r.ok) {
      if (r.reason === 'capacity') {
        sfxCapacityBlocked();
        (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-blocked');
      }
      return;
    }
    const pig = this.state.pigs[this.state.pigs.length - 1];
    if (pig) {
      const sprite = new PigSprite(this, pig);
      this.pigSprites.set(pig.id, sprite);
    }
    (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-slot-changed', slotIndex);
  }

  private handleQuit(): void {
    this.cleanup();
    this.scene.stop('UIScene');
    this.scene.start('TitleScene');
  }

  private handleRetry(): void {
    const id = this.levelId;
    this.cleanup();
    this.scene.stop('UIScene');
    this.scene.start('LevelScene', { levelId: id });
  }

  private handleNext(): void {
    const manifest = this.registry.get('levelManifest') as { id: string }[];
    const idx = manifest.findIndex((m) => m.id === this.levelId);
    const next = manifest[idx + 1];
    this.cleanup();
    this.scene.stop('UIScene');
    if (next) {
      this.scene.start('LevelScene', { levelId: next.id });
    } else {
      this.scene.start('TitleScene');
    }
  }

  private cleanup(): void {
    this.pigSprites.forEach((p) => p.destroy(this));
    this.pigSprites.clear();
    this.cubeSprites.forEach((c) => c.destroy());
    this.cubeSprites.clear();
  }

  private handleWin(): void {
    this.state.status = 'won';
    sfxLevelClear();
    this.confettiSweep();
    const stars = this.computeStars();
    recordLevelCleared(this.levelId, stars);
    (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-result', 'won', stars);
  }

  private computeStars(): number {
    const total = this.state.level.inventory.length;
    if (total <= 0) return 3;
    const used = total - this.state.inventory.length;
    const ratio = used / total;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.85) return 2;
    return 1;
  }

  private handleLose(): void {
    this.state.status = 'lost';
    sfxFail();
    (this.scene.get('UIScene') as Phaser.Scene).events.emit('pf:ui-result', 'lost', 0);
  }

  private confettiSweep(): void {
    const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0xe91e63, 0x9b59b6];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * LOGICAL_WIDTH;
      const y = Math.random() * LOGICAL_HEIGHT * 0.7;
      const c = colors[i % colors.length];
      const r = this.add.rectangle(x, y - 50, 10, 10, c);
      this.tweens.add({
        targets: r,
        y: y + 200 + Math.random() * 400,
        angle: Math.random() * 720 - 360,
        alpha: 0,
        duration: 1200 + Math.random() * 800,
        ease: 'Quad.easeIn',
        onComplete: () => r.destroy(),
      });
    }
  }

}
