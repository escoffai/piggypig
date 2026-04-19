import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/systems/WinFailSystem';
import {
  makeBelt,
  makeCube,
  makeInvEntry,
  makeLevel,
  makePig,
  makeState,
} from './fixtures';

describe('WinFailSystem.evaluate', () => {
  it('reports won when all cubes cleared', () => {
    const level = makeLevel();
    const state = makeState(level);
    expect(evaluate(state)).toBe('won');
  });

  it('reports lost when belt/slots empty and no tappable inventory remains', () => {
    const level = makeLevel({
      cubes: [makeCube(0, 0, 'red')],
      inventory: [makeInvEntry('a', { color: 'red', ammo: 1, locked: 'beltEmpty' })],
    });
    const state = makeState(level);
    // beltEmpty is TRUE (no pigs on belt), so 'a' is tappable and we are playing.
    expect(evaluate(state)).toBe('playing');
    // Change the lock to one that will never trigger (no blue cubes to clear).
    state.inventory[0].locked = 'cubesOfColorCleared:blue:1';
    expect(evaluate(state)).toBe('lost');
  });

  it('reports lost when remaining cubes have a color no pig anywhere matches', () => {
    const level = makeLevel({
      cubes: [makeCube(0, 0, 'purple')],
      inventory: [makeInvEntry('a', { color: 'red', ammo: 10 })],
    });
    const state = makeState(level);
    expect(evaluate(state)).toBe('lost');
  });

  it('stays playing when a pig is on belt and a matching cube remains', () => {
    const level = makeLevel({
      cubes: [makeCube(0, 0, 'red')],
    });
    const state = makeState(level);
    state.pigs.push(makePig({ color: 'red', ammo: 3 }));
    expect(evaluate(state)).toBe('playing');
  });

  it('reports lost when slots full, belt full with non-matching pigs, and no matching inventory exists', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 1 }),
      cubes: [makeCube(0, 0, 'red')],
      inventory: [makeInvEntry('a', { color: 'blue', ammo: 5 })],
    });
    const state = makeState(level);
    // All slots full with blue pigs.
    for (let i = 0; i < 5; i++) {
      state.slots[i].pig = makePig({ color: 'blue', ammo: 1 });
    }
    // Belt has a blue pig.
    state.pigs.push(makePig({ color: 'blue', ammo: 1 }));
    // Remaining cube is red but no red pigs anywhere → dead.
    expect(evaluate(state)).toBe('lost');
  });

  it('playing when slots full and belt pig COULD clear remaining cubes', () => {
    const level = makeLevel({
      belt: makeBelt({ capacity: 1 }),
      cubes: [makeCube(0, 0, 'red')],
      inventory: [],
    });
    const state = makeState(level);
    for (let i = 0; i < 5; i++) {
      state.slots[i].pig = makePig({ color: 'red', ammo: 1 });
    }
    state.pigs.push(makePig({ color: 'red', ammo: 2 }));
    expect(evaluate(state)).toBe('playing');
  });
});
