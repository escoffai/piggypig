import { describe, expect, it } from 'vitest';
import { evaluateLock } from '../src/systems/Locks';
import { makeCube, makeLevel, makePig, makeState } from './fixtures';

describe('Locks.evaluateLock', () => {
  it('beltEmpty is true when no pigs on belt', () => {
    const s = makeState(makeLevel());
    expect(evaluateLock(s, 'beltEmpty')).toBe(true);
    s.pigs.push(makePig({ color: 'red', ammo: 1 }));
    expect(evaluateLock(s, 'beltEmpty')).toBe(false);
  });

  it('cubesOfColorCleared: requires count met', () => {
    const s = makeState(makeLevel());
    s.clearedByColor.red = 2;
    expect(evaluateLock(s, 'cubesOfColorCleared:red:2')).toBe(true);
    expect(evaluateLock(s, 'cubesOfColorCleared:red:3')).toBe(false);
    expect(evaluateLock(s, 'cubesOfColorCleared:blue:1')).toBe(false);
  });

  it('slotsFree handles comparison operators', () => {
    const s = makeState(makeLevel());
    // All 5 slots free by default.
    expect(evaluateLock(s, 'slotsFree:>=3')).toBe(true);
    expect(evaluateLock(s, 'slotsFree:>=5')).toBe(true);
    expect(evaluateLock(s, 'slotsFree:<=2')).toBe(false);
    s.slots[0].pig = makePig({ color: 'red', ammo: 1 });
    s.slots[1].pig = makePig({ color: 'red', ammo: 1 });
    expect(evaluateLock(s, 'slotsFree:=3')).toBe(true);
  });

  it('cubesRemaining handles operators', () => {
    const s = makeState(
      makeLevel({
        cubes: [makeCube(0, 0, 'red'), makeCube(1, 0, 'red'), makeCube(2, 0, 'red')],
      }),
    );
    expect(evaluateLock(s, 'cubesRemaining:<=3')).toBe(true);
    expect(evaluateLock(s, 'cubesRemaining:<=2')).toBe(false);
    expect(evaluateLock(s, 'cubesRemaining:=3')).toBe(true);
  });

  it('returns false for unknown condition grammars', () => {
    const s = makeState(makeLevel());
    expect(evaluateLock(s, 'bogus:condition')).toBe(false);
    expect(evaluateLock(s, 'slotsFree:banana')).toBe(false);
  });
});
