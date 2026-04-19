// Integration: load every shipped level JSON + PNG and prove it solves under a
// greedy auto-player. Catches ammo/capacity miscalibration early.
//
// Policy: each "decision moment" (after every parking/despawn event or every
// 200 ms of sim time), deploy the leftmost tappable asset. Prefer slot pigs
// (to free slots) when any slot pig exists; otherwise the frontmost tappable
// inventory entry. If nothing is tappable, just keep ticking.
//
// Timeout per level: 180 simulated seconds.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { tickBelt } from '../src/systems/BeltSystem';
import { deployFromInventory, isEntryTappable, resetPigIdSeq } from '../src/systems/InventorySystem';
import { resolveHits } from '../src/systems/ShootingSystem';
import { parkLoopedPigs, redeployFromSlot } from '../src/systems/WaitingSlotsSystem';
import { applyOutcome } from '../src/systems/WinFailSystem';
import { buildLevel, initialState, type LevelJson } from '../src/loaders/levelLoader';
import type { PixelImage } from '../src/loaders/pngLevelLoader';
import { TICK_MS } from '../src/config';
import type { GameState } from '../src/types';

const LEVEL_IDS = ['level-01', 'level-02', 'level-03', 'level-04', 'level-05'];

function loadPixelImage(path: string): PixelImage {
  const buf = readFileSync(path);
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

function loadLevel(id: string): GameState {
  const root = resolve(__dirname, '..', 'levels');
  const json = JSON.parse(readFileSync(resolve(root, `${id}.json`), 'utf8')) as LevelJson;
  const img = loadPixelImage(resolve(root, `${id}.png`));
  const level = buildLevel(json, img);
  return initialState(level);
}

function firstTappableInventoryId(state: GameState): string | null {
  for (const e of state.inventory) {
    if (isEntryTappable(state, e)) return e.id;
  }
  return null;
}

function firstSlotIndexWithPig(state: GameState): number {
  for (let i = 0; i < state.slots.length; i++) {
    if (state.slots[i].pig) return i;
  }
  return -1;
}

// A single "greedy" decision tick: try to deploy something.
function makeDecision(state: GameState): 'deployed' | 'idle' {
  // If the belt has zero pigs, deploy priority goes to the inventory (introduce new
  // pigs) before parking them back into slots.
  if (state.pigs.length === 0) {
    const invId = firstTappableInventoryId(state);
    if (invId) {
      const r = deployFromInventory(state, invId);
      if (r.reason === 'ok') return 'deployed';
    }
    const slotIdx = firstSlotIndexWithPig(state);
    if (slotIdx >= 0) {
      const r = redeployFromSlot(state, slotIdx);
      if (r.ok) return 'deployed';
    }
    return 'idle';
  }
  // Otherwise, prefer to cycle slot pigs (so they don't clog) and fall back to inventory.
  const slotIdx = firstSlotIndexWithPig(state);
  if (slotIdx >= 0) {
    const r = redeployFromSlot(state, slotIdx);
    if (r.ok) return 'deployed';
  }
  const invId = firstTappableInventoryId(state);
  if (invId) {
    const r = deployFromInventory(state, invId);
    if (r.reason === 'ok') return 'deployed';
  }
  return 'idle';
}

function simulate(state: GameState, maxMs = 180_000): { status: GameState['status']; ms: number } {
  let t = 0;
  let nextDecisionAt = 0;
  while (t < maxMs) {
    if (t >= nextDecisionAt) {
      makeDecision(state);
      nextDecisionAt = t + 250;
    }
    tickBelt(state, TICK_MS);
    resolveHits(state, TICK_MS);
    parkLoopedPigs(state);
    applyOutcome(state);
    if (state.status !== 'playing') return { status: state.status, ms: t };
    t += TICK_MS;
  }
  return { status: state.status, ms: t };
}

describe('shipped levels are solvable', () => {
  for (const id of LEVEL_IDS) {
    it(`${id} is solvable by greedy auto-player`, () => {
      resetPigIdSeq(); // determinism
      const state = loadLevel(id);
      const res = simulate(state);
      if (res.status !== 'won') {
        const cubesLeft = state.cubes.size;
        const beltCount = state.pigs.length;
        const slotsUsed = state.slots.filter((s) => s.pig).length;
        const invLeft = state.inventory.length;
        throw new Error(
          `${id} did not solve: status=${res.status} at ${res.ms}ms ` +
            `(cubes=${cubesLeft} belt=${beltCount} slots=${slotsUsed} inv=${invLeft})`,
        );
      }
      expect(res.status).toBe('won');
    });
  }
});
