// WaitingSlotsSystem: park looped pigs in the leftmost free slot; redeploy on tap.

import { DEFAULT_SHOT_COOLDOWN_MS, SLOT_COUNT } from '../config';
import { canDeploy, spawnPigOnBelt } from './BeltSystem';
import type { GameState, Pig, Slot } from '../types';

export function makeSlots(): Slot[] {
  return Array.from({ length: SLOT_COUNT }, () => ({ pig: null }));
}

export interface ParkResult {
  parked: { slotIndex: number; pig: Pig }[];
  removedPigIds: string[];
}

// Inspect every pig; any pig that has completed a loop (looped=true) AND has ammo>0
// is pulled off the belt into the leftmost free slot. If no slot is free, the pig
// stays on the belt (will try again at next waypoint pass — this prevents a silent fail).
export function parkLoopedPigs(state: GameState): ParkResult {
  const parked: ParkResult['parked'] = [];
  const removed: string[] = [];
  const survivors: Pig[] = [];

  for (const pig of state.pigs) {
    if (pig.looped && pig.ammo > 0) {
      const idx = state.slots.findIndex((s) => s.pig == null);
      if (idx >= 0) {
        // Reset per-deploy state so redeploy is fresh.
        pig.distance = 0;
        pig.looped = false;
        pig.shotCooldown = DEFAULT_SHOT_COOLDOWN_MS;
        pig.ageMs = 0;
        state.slots[idx].pig = pig;
        parked.push({ slotIndex: idx, pig });
        removed.push(pig.id);
        continue;
      }
      // All slots full: clamp distance so pig rides the loop again rather than
      // falling off the world. Also reset looped so it can re-trigger next loop.
      pig.distance = pig.distance % state.beltLength;
      pig.looped = false;
    }
    survivors.push(pig);
  }
  state.pigs = survivors;
  return { parked, removedPigIds: removed };
}

export function redeployFromSlot(
  state: GameState,
  slotIndex: number,
): { ok: boolean; reason?: 'empty' | 'capacity' } {
  const slot = state.slots[slotIndex];
  if (!slot || !slot.pig) return { ok: false, reason: 'empty' };
  if (!canDeploy(state, 1)) return { ok: false, reason: 'capacity' };
  const pig = slot.pig;
  slot.pig = null;
  pig.distance = 0;
  pig.looped = false;
  pig.shotCooldown = DEFAULT_SHOT_COOLDOWN_MS;
  pig.ageMs = 0;
  spawnPigOnBelt(state, pig);
  return { ok: true };
}

export function slotsFreeCount(state: GameState): number {
  return state.slots.filter((s) => s.pig == null).length;
}

export function slotsAllFull(state: GameState): boolean {
  return state.slots.every((s) => s.pig != null);
}

export function slotsAllEmpty(state: GameState): boolean {
  return state.slots.every((s) => s.pig == null);
}
