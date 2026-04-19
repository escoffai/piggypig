// UIScene: HUD overlay — capacity readout, waiting slots, inventory grid, X/settings.

import Phaser from 'phaser';
import {
  COLOR_HEX,
  INVENTORY_BG_HEX,
  INVENTORY_GAP,
  INVENTORY_TILE,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  SLOT_BG_HEX,
  SLOT_COUNT,
  SLOT_GAP,
  SLOT_SIZE,
} from '../config';
import { isEntryTappable } from '../systems/InventorySystem';
import { evaluateLock } from '../systems/Locks';
import { isMuted, setMuted, sfxTap } from '../systems/SoundSystem';
import type { GameState, InventoryEntry, Pig, Slot } from '../types';

interface SlotNode {
  bg: Phaser.GameObjects.Rectangle;
  hit: Phaser.GameObjects.Rectangle;
  body?: Phaser.GameObjects.Container;
}

interface InventoryNode {
  entryId: string;
  bg: Phaser.GameObjects.Rectangle;
  body: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  lockIcon?: Phaser.GameObjects.Text;
  hiddenLabel?: Phaser.GameObjects.Text;
  chainBar?: Phaser.GameObjects.Rectangle;
  hit: Phaser.GameObjects.Rectangle;
}

export class UIScene extends Phaser.Scene {
  private state!: GameState;
  private capacityText!: Phaser.GameObjects.Text;
  private slotNodes: SlotNode[] = [];
  private invNodes: InventoryNode[] = [];
  private resultPanel?: Phaser.GameObjects.Container;
  private muteBtn!: Phaser.GameObjects.Text;
  private slotsY = 0;
  private invY = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.state = this.registry.get('state') as GameState;

    // Top row: X and settings.
    const closeBtn = this.add
      .text(40, 40, '✕', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '40px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      sfxTap();
      this.openQuitConfirm();
    });

    this.muteBtn = this.add
      .text(LOGICAL_WIDTH - 40, 40, isMuted() ? '🔇' : '🔊', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '36px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);
    this.muteBtn.setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      setMuted(!isMuted());
      this.muteBtn.setText(isMuted() ? '🔇' : '🔊');
    });

    // Capacity readout.
    this.capacityText = this.add
      .text(LOGICAL_WIDTH / 2, this.capacityY(), `0/${this.state.level.belt.capacity}`, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '32px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    this.slotsY = this.capacityY() + 56;
    this.invY = this.slotsY + SLOT_SIZE + 40;

    this.buildSlots();
    this.buildInventory();

    // Event wiring.
    this.events.on('pf:ui-tick', (onBelt: number, capacity: number) => {
      this.capacityText.setText(`${onBelt}/${capacity}`);
      this.capacityText.setColor(onBelt >= capacity ? '#ef4444' : '#e2e8f0');
      this.refreshInventoryLockStates();
    });
    this.events.on('pf:ui-blocked', () => this.flashCapacityRed());
    this.events.on('pf:ui-park', (slotIndex: number, pig: Pig) =>
      this.renderSlotContents(slotIndex, pig),
    );
    this.events.on('pf:ui-slot-changed', (slotIndex: number) =>
      this.renderSlotContents(slotIndex, null),
    );
    this.events.on('pf:ui-inventory-changed', () => this.rebuildInventoryLayout());
    this.events.on('pf:ui-result', (outcome: 'won' | 'lost') => this.showResult(outcome));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.removeAllListeners();
    });
  }

  // -- Layout helpers --

  private capacityY(): number {
    // Right below the board. Compute the lowest belt y.
    let maxY = 0;
    for (const w of this.state.level.belt.path) if (w.y > maxY) maxY = w.y;
    return maxY + 60;
  }

  private slotsTotalWidth(): number {
    return SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP;
  }

  private buildSlots(): void {
    const total = this.slotsTotalWidth();
    const startX = (LOGICAL_WIDTH - total) / 2 + SLOT_SIZE / 2;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const x = startX + i * (SLOT_SIZE + SLOT_GAP);
      const y = this.slotsY + SLOT_SIZE / 2;
      const bg = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, SLOT_BG_HEX);
      bg.setStrokeStyle(2, 0x334155, 0.6);
      const hit = this.add.rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        const s = this.state.slots[i];
        if (s.pig) {
          (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:deploy-slot', i);
        }
      });
      this.slotNodes.push({ bg, hit });
    }
  }

  private renderSlotContents(slotIndex: number, _pig: Pig | null): void {
    const node = this.slotNodes[slotIndex];
    if (!node) return;
    if (node.body) {
      node.body.destroy(true);
      node.body = undefined;
    }
    const slot = this.state.slots[slotIndex];
    if (!slot.pig) return;
    node.body = this.makePigVisual(slot.pig.color, slot.pig.ammo, node.bg.x, node.bg.y);
  }

  private makePigVisual(
    color: keyof typeof COLOR_HEX,
    ammo: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const size = SLOT_SIZE - 18;
    const c = this.add.container(x, y);
    const body = this.add
      .rectangle(0, 0, size, size, COLOR_HEX[color])
      .setStrokeStyle(2, 0x000000, 0.6);
    const earL = this.add.triangle(
      -size * 0.3,
      -size * 0.5,
      0,
      0,
      size * 0.22,
      0,
      size * 0.11,
      -size * 0.22,
      COLOR_HEX[color],
    );
    const earR = this.add.triangle(
      size * 0.3,
      -size * 0.5,
      0,
      0,
      size * 0.22,
      0,
      size * 0.11,
      -size * 0.22,
      COLOR_HEX[color],
    );
    earL.setStrokeStyle(1, 0x000000, 0.5);
    earR.setStrokeStyle(1, 0x000000, 0.5);
    const snout = this.add.ellipse(0, size * 0.18, size * 0.36, size * 0.22, 0x000000, 0.22);
    const label = this.add
      .text(0, 0, String(ammo), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: `${Math.floor(size * 0.5)}px`,
        color: '#000',
      })
      .setOrigin(0.5);
    c.add([body, earL, earR, snout, label]);
    return c;
  }

  // -- Inventory rendering --

  private buildInventory(): void {
    this.clearInventory();
    const cols = 5;
    const startX = (LOGICAL_WIDTH - (cols * INVENTORY_TILE + (cols - 1) * INVENTORY_GAP)) / 2 + INVENTORY_TILE / 2;
    // Label above
    this.add
      .text(LOGICAL_WIDTH / 2, this.invY - 26, 'INVENTORY', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '18px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.state.inventory.forEach((entry, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (INVENTORY_TILE + INVENTORY_GAP);
      const y = this.invY + row * (INVENTORY_TILE + INVENTORY_GAP) + INVENTORY_TILE / 2;

      const bg = this.add.rectangle(x, y, INVENTORY_TILE, INVENTORY_TILE, INVENTORY_BG_HEX);
      bg.setStrokeStyle(2, 0x334155, 0.5);

      const isHiddenFrontUnrevealed = entry.hidden === true && i === 0;
      const visualColor: keyof typeof COLOR_HEX =
        entry.hidden && i !== 0 ? 'purple' : entry.color ?? 'purple';

      const body = this.makePigVisual(visualColor, entry.ammo, x, y);

      const label = this.add
        .text(x, y, String(entry.ammo), {
          fontFamily: 'Arial Black, Arial, sans-serif',
          fontSize: '28px',
          color: '#000',
        })
        .setOrigin(0.5);
      label.setVisible(false);

      let hiddenLabel: Phaser.GameObjects.Text | undefined;
      if (entry.hidden && !isHiddenFrontUnrevealed) {
        // Not yet revealed: stamp "?" over body.
        hiddenLabel = this.add
          .text(x, y, '?', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '44px',
            color: '#fefefe',
          })
          .setOrigin(0.5);
      } else if (isHiddenFrontUnrevealed) {
        // At-front hidden: reveal now with a flip.
        entry.hidden = false;
      }

      let lockIcon: Phaser.GameObjects.Text | undefined;
      if (entry.locked) {
        lockIcon = this.add
          .text(x + INVENTORY_TILE / 2 - 14, y - INVENTORY_TILE / 2 + 14, '🔒', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
          })
          .setOrigin(0.5);
      }

      let chainBar: Phaser.GameObjects.Rectangle | undefined;
      if (entry.chainId) {
        const prev = this.state.inventory[i - 1];
        if (prev && prev.chainId === entry.chainId) {
          chainBar = this.add.rectangle(
            x - (INVENTORY_TILE + INVENTORY_GAP) / 2,
            y,
            INVENTORY_GAP + 4,
            10,
            0xfbbf24,
          );
        }
      }

      const hit = this.add.rectangle(x, y, INVENTORY_TILE, INVENTORY_TILE, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (!isEntryTappable(this.state, entry)) {
          sfxTap();
          this.flashNode(bg);
          return;
        }
        (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:deploy-inventory', entry.id);
      });

      this.invNodes.push({ entryId: entry.id, bg, body, label, lockIcon, hiddenLabel, chainBar, hit });
    });

    this.refreshInventoryLockStates();
  }

  private rebuildInventoryLayout(): void {
    this.buildInventory();
  }

  private clearInventory(): void {
    for (const n of this.invNodes) {
      n.bg.destroy();
      n.body.destroy(true);
      n.label.destroy();
      n.lockIcon?.destroy();
      n.hiddenLabel?.destroy();
      n.chainBar?.destroy();
      n.hit.destroy();
    }
    this.invNodes = [];
  }

  private refreshInventoryLockStates(): void {
    for (const n of this.invNodes) {
      const entry = this.state.inventory.find((e) => e.id === n.entryId);
      if (!entry) continue;
      const unlocked = !entry.locked || evaluateLock(this.state, entry.locked);
      if (n.lockIcon) {
        n.lockIcon.setVisible(!unlocked);
        if (unlocked) {
          n.lockIcon.destroy();
          n.lockIcon = undefined;
        }
      }
      n.bg.setAlpha(unlocked ? 1 : 0.55);
    }
  }

  private flashCapacityRed(): void {
    const original = this.capacityText.style.color;
    this.capacityText.setColor('#ef4444');
    this.tweens.add({
      targets: this.capacityText,
      scale: 1.25,
      duration: 80,
      yoyo: true,
      onComplete: () => this.capacityText.setColor(original),
    });
    this.cameras.main.shake(120, 0.003);
  }

  private flashNode(bg: Phaser.GameObjects.Rectangle): void {
    const prev = bg.fillColor;
    bg.setFillStyle(0x3b0a0a);
    this.time.delayedCall(140, () => bg.setFillStyle(prev));
  }

  // -- Result panel --

  private showResult(outcome: 'won' | 'lost'): void {
    if (this.resultPanel) return;
    const w = LOGICAL_WIDTH * 0.82;
    const h = 360;
    const c = this.add.container(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    const bg = this.add
      .rectangle(0, 0, w, h, 0x0f172a, 0.96)
      .setStrokeStyle(3, outcome === 'won' ? 0x2ecc71 : 0xef4444);
    const title = this.add
      .text(0, -110, outcome === 'won' ? 'LEVEL CLEARED' : 'STUCK', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '48px',
        color: outcome === 'won' ? '#2ecc71' : '#ef4444',
      })
      .setOrigin(0.5);

    const stars =
      outcome === 'won'
        ? this.computeStars(this.state.level.inventory.length - this.state.inventory.length)
        : 0;
    const starText = this.add
      .text(0, -50, outcome === 'won' ? '★'.repeat(stars).padEnd(3, '☆') : ' ', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '56px',
        color: '#f1c40f',
      })
      .setOrigin(0.5);

    const retry = this.makeButton(0, 50, 'RETRY', () => {
      sfxTap();
      (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:retry');
    });
    const next = this.makeButton(
      0,
      130,
      outcome === 'won' ? 'NEXT LEVEL' : 'QUIT',
      () => {
        sfxTap();
        if (outcome === 'won') {
          (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:next');
        } else {
          (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:quit');
        }
      },
    );

    c.add([bg, title, starText, retry, next]);
    this.resultPanel = c;
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: c,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  private computeStars(used: number): number {
    const total = this.state.level.inventory.length;
    if (total <= 0) return 3;
    const ratio = used / total;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.85) return 2;
    return 1;
  }

  private makeButton(
    x: number,
    y: number,
    text: string,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const w = 320;
    const h = 64;
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x3498db).setStrokeStyle(2, 0xfefefe, 0.4);
    const t = this.add
      .text(0, 0, text, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '26px',
        color: '#fefefe',
      })
      .setOrigin(0.5);
    c.add([bg, t]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.tweens.add({
        targets: c,
        scale: 0.95,
        duration: 60,
        yoyo: true,
        onComplete: onTap,
      });
    });
    return c;
  }

  private openQuitConfirm(): void {
    const c = this.add.container(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    const bg = this.add.rectangle(0, 0, 500, 260, 0x0f172a, 0.96).setStrokeStyle(3, 0x64748b);
    const t = this.add
      .text(0, -60, 'Quit level?', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '34px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);
    const yes = this.makeButton(-110, 40, 'QUIT', () => {
      (this.scene.get('LevelScene') as Phaser.Scene).events.emit('pf:quit');
    });
    const no = this.makeButton(110, 40, 'STAY', () => {
      c.destroy(true);
    });
    c.add([bg, t, yes, no]);
  }

  // Public helper used by tests / debug: unused in production but kept to
  // make Slot a real participant in the module.
  public getSlots(): Slot[] {
    return this.state.slots;
  }
  public getInventory(): InventoryEntry[] {
    return this.state.inventory;
  }
}
