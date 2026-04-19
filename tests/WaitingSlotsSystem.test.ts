import { describe, expect, it } from 'vitest';
import {
  makeSlots,
  parkLoopedPigs,
  redeployFromSlot,
  slotsAllEmpty,
  slotsAllFull,
  slotsFreeCount,
} from '../src/systems/WaitingSlotsSystem';
import { makeBelt, makeLevel, makePig, makeState } from './fixtures';

describe('WaitingSlotsSystem', () => {
  it('makeSlots yields exactly 5 empty slots', () => {
    const slots = makeSlots();
    expect(slots).toHaveLength(5);
    expect(slots.every((s) => s.pig == null)).toBe(true);
  });

  it('parks looped pigs in the leftmost free slot', () => {
    const level = makeLevel();
    const state = makeState(level);
    const a = makePig({ color: 'red', ammo: 3, looped: true, id: 'a' });
    const b = makePig({ color: 'blue', ammo: 2, looped: true, id: 'b' });
    state.pigs.push(a, b);

    parkLoopedPigs(state);

    expect(state.pigs).toHaveLength(0);
    expect(state.slots[0].pig?.id).toBe('a');
    expect(state.slots[1].pig?.id).toBe('b');
    expect(state.slots[2].pig).toBeNull();
  });

  it('does NOT park a pig whose ammo is 0', () => {
    const level = makeLevel();
    const state = makeState(level);
    const a = makePig({ color: 'red', ammo: 0, looped: true });
    state.pigs.push(a);
    parkLoopedPigs(state);
    // ammo 0 pigs should not park; they are removed by ShootingSystem, so here they just stay on belt (no-op).
    expect(state.slots.every((s) => s.pig == null)).toBe(true);
  });

  it('redeployFromSlot respects capacity', () => {
    const level = makeLevel({ belt: makeBelt({ capacity: 1 }) });
    const state = makeState(level);
    state.slots[0].pig = makePig({ color: 'red', ammo: 3, id: 's1' });
    state.pigs.push(makePig({ color: 'blue', ammo: 1, id: 'b1' }));
    const r = redeployFromSlot(state, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('capacity');
    expect(state.slots[0].pig?.id).toBe('s1');
  });

  it('redeployFromSlot moves pig back onto belt when capacity allows', () => {
    const level = makeLevel({ belt: makeBelt({ capacity: 2 }) });
    const state = makeState(level);
    state.slots[0].pig = makePig({ color: 'red', ammo: 3, id: 's1' });
    const r = redeployFromSlot(state, 0);
    expect(r.ok).toBe(true);
    expect(state.slots[0].pig).toBeNull();
    expect(state.pigs.find((p) => p.id === 's1')).toBeDefined();
  });

  it('redeployFromSlot returns empty reason for empty slot', () => {
    const level = makeLevel();
    const state = makeState(level);
    const r = redeployFromSlot(state, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty');
  });

  it('slot occupancy helpers report correct counts', () => {
    const level = makeLevel();
    const state = makeState(level);
    expect(slotsFreeCount(state)).toBe(5);
    expect(slotsAllFull(state)).toBe(false);
    expect(slotsAllEmpty(state)).toBe(true);
    for (let i = 0; i < 5; i++) {
      state.slots[i].pig = makePig({ color: 'red', ammo: 1 });
    }
    expect(slotsFreeCount(state)).toBe(0);
    expect(slotsAllFull(state)).toBe(true);
    expect(slotsAllEmpty(state)).toBe(false);
  });

  it('parks rightward when prior slots already occupied', () => {
    const level = makeLevel();
    const state = makeState(level);
    state.slots[0].pig = makePig({ color: 'red', ammo: 1, id: 'pre' });
    const incoming = makePig({ color: 'green', ammo: 2, looped: true, id: 'new' });
    state.pigs.push(incoming);
    parkLoopedPigs(state);
    expect(state.slots[0].pig?.id).toBe('pre');
    expect(state.slots[1].pig?.id).toBe('new');
  });
});
