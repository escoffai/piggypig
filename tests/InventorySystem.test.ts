import { describe, expect, it, beforeEach } from 'vitest';
import {
  countTappable,
  deployFromInventory,
  isEntryTappable,
  resetPigIdSeq,
} from '../src/systems/InventorySystem';
import { makeBelt, makeInvEntry, makeLevel, makeState } from './fixtures';

beforeEach(() => resetPigIdSeq());

describe('InventorySystem.deployFromInventory', () => {
  it('deploys a simple entry onto the belt', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 2 }),
      inventory: [makeInvEntry('a', { color: 'red', ammo: 5 })],
    });
    const state = makeState(level);
    const r = deployFromInventory(state, 'a');
    expect(r.reason).toBe('ok');
    expect(r.deployed).toHaveLength(1);
    expect(state.pigs).toHaveLength(1);
    expect(state.inventory).toHaveLength(0);
  });

  it('rejects when belt is at capacity', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 1 }),
      inventory: [
        makeInvEntry('a', { color: 'red', ammo: 5 }),
        makeInvEntry('b', { color: 'blue', ammo: 5 }),
      ],
    });
    const state = makeState(level);
    deployFromInventory(state, 'a');
    const r = deployFromInventory(state, 'b');
    expect(r.reason).toBe('capacity');
    expect(state.pigs).toHaveLength(1);
    expect(state.inventory.find((e) => e.id === 'b')).toBeDefined();
  });

  it('deploys a whole chain or none (all-or-nothing)', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 1 }), // capacity too small for 2-chain
      inventory: [
        makeInvEntry('c1', { color: 'white', ammo: 5, chainId: 'x' }),
        makeInvEntry('c2', { color: 'white', ammo: 5, chainId: 'x' }),
      ],
    });
    const state = makeState(level);
    const r = deployFromInventory(state, 'c1');
    expect(r.reason).toBe('capacity');
    expect(state.pigs).toHaveLength(0);
    expect(state.inventory).toHaveLength(2);
  });

  it('deploys chain when capacity fits', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 3 }),
      inventory: [
        makeInvEntry('c1', { color: 'white', ammo: 5, chainId: 'x' }),
        makeInvEntry('c2', { color: 'white', ammo: 5, chainId: 'x' }),
        makeInvEntry('solo', { color: 'red', ammo: 2 }),
      ],
    });
    const state = makeState(level);
    const r = deployFromInventory(state, 'c1');
    expect(r.reason).toBe('ok');
    expect(r.deployed).toHaveLength(2);
    expect(state.pigs).toHaveLength(2);
    expect(state.inventory.map((e) => e.id)).toEqual(['solo']);
  });

  it('rejects deploying a locked entry until condition satisfied', () => {
    const level = makeLevel({
      inventory: [makeInvEntry('a', { color: 'pink', ammo: 1, locked: 'beltEmpty' })],
    });
    const state = makeState(level);
    expect(isEntryTappable(state, state.inventory[0])).toBe(true);
    // Simulate a pig on belt so beltEmpty becomes false.
    state.pigs.push({
      id: 'z',
      color: 'red',
      ammo: 1,
      distance: 0,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      shotCooldown: 0,
      ageMs: 0,
      looped: false,
    });
    expect(isEntryTappable(state, state.inventory[0])).toBe(false);
    const r = deployFromInventory(state, 'a');
    expect(r.reason).toBe('locked');
  });

  it('hidden entry is only tappable when at front of queue', () => {
    const level = makeLevel({
      inventory: [
        makeInvEntry('a', { color: 'green', ammo: 1 }),
        makeInvEntry('b', { color: 'yellow', ammo: 1, hidden: true }),
      ],
    });
    const state = makeState(level);
    expect(isEntryTappable(state, state.inventory[1])).toBe(false);
    // Consume 'a' to bring 'b' to the front, revealing it.
    deployFromInventory(state, 'a');
    expect(state.inventory[0].hidden).toBe(false);
    expect(isEntryTappable(state, state.inventory[0])).toBe(true);
  });

  it('countTappable reflects current gating', () => {
    const level = makeLevel({
      inventory: [
        makeInvEntry('a', { color: 'red', ammo: 1 }),
        makeInvEntry('b', { color: 'green', ammo: 1, hidden: true }),
        makeInvEntry('c', { color: 'blue', ammo: 1, locked: 'cubesRemaining:<=0' }),
      ],
    });
    const state = makeState(level);
    // 'a' tappable; 'b' hidden but not front → not tappable; 'c' locked (cubes remaining 0 is satisfied since no cubes).
    expect(countTappable(state)).toBe(2);
  });
});
