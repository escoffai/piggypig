import { describe, expect, it } from 'vitest';
import {
  canDeploy,
  computeBeltLengths,
  onBeltCount,
  sampleBelt,
  spawnPigOnBelt,
  tickBelt,
} from '../src/systems/BeltSystem';
import { makeBelt, makeLevel, makePig, makeState, rectPath } from './fixtures';

describe('BeltSystem', () => {
  it('computes segment and cumulative arc-lengths', () => {
    const path = rectPath();
    const { segmentLengths, cumulativeLengths, totalLength } = computeBeltLengths(path);
    // rectangle 100,600 -> 100,200 (400) -> 500,200 (400) -> 500,600 (400) -> 100,600 (400)
    expect(segmentLengths).toEqual([400, 400, 400, 400]);
    expect(cumulativeLengths).toEqual([0, 400, 800, 1200, 1600]);
    expect(totalLength).toBe(1600);
  });

  it('samples correct world position and unit direction along a straight segment', () => {
    const path = rectPath();
    const { cumulativeLengths, totalLength } = computeBeltLengths(path);
    // 200 along first segment (up from y=600): should be at (100, 400), dir (0, -1)
    const s = sampleBelt(path, cumulativeLengths, totalLength, 200);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(400);
    expect(s.dirX).toBeCloseTo(0);
    expect(s.dirY).toBeCloseTo(-1);
  });

  it('wraps distance across the full loop', () => {
    const path = rectPath();
    const { cumulativeLengths, totalLength } = computeBeltLengths(path);
    const s = sampleBelt(path, cumulativeLengths, totalLength, totalLength + 50);
    expect(s.x).toBeCloseTo(100);
    expect(s.y).toBeCloseTo(550); // 50 up from y=600
  });

  it('advances pigs at constant speed and flips looped when crossing total length', () => {
    const level = makeLevel({ belt: makeBelt({ speed: 800 }) });
    const state = makeState(level);
    const pig = makePig({ color: 'green', ammo: 10, distance: 1590 });
    spawnPigOnBelt(state, pig);
    // 1600 total length. Speed 800 px/s. 50 ms = 40 px advance. 1590 + 40 = 1630 → loops past 1600.
    tickBelt(state, 50);
    expect(pig.looped).toBe(true);
    expect(pig.distance).toBeCloseTo(1630);
  });

  it('capacity gate respects pigs on belt', () => {
    const level = makeLevel({ belt: makeBelt({ capacity: 2 }) });
    const state = makeState(level);
    expect(canDeploy(state, 1)).toBe(true);
    expect(onBeltCount(state)).toBe(0);
    state.pigs.push(makePig({ color: 'red', ammo: 1 }));
    expect(canDeploy(state, 1)).toBe(true);
    state.pigs.push(makePig({ color: 'red', ammo: 1 }));
    expect(canDeploy(state, 1)).toBe(false);
    expect(onBeltCount(state)).toBe(2);
  });

  it('direction updates after crossing a waypoint', () => {
    const level = makeLevel({ belt: makeBelt({ speed: 500 }) });
    const state = makeState(level);
    // Place a pig at distance 395 (on first segment, near top-left corner).
    const pig = makePig({ color: 'red', ammo: 1, distance: 395 });
    spawnPigOnBelt(state, pig);
    expect(pig.dirX).toBeCloseTo(0);
    expect(pig.dirY).toBeCloseTo(-1);
    tickBelt(state, 20); // 10 px advance → distance 405 → onto top segment
    expect(pig.dirX).toBeCloseTo(1);
    expect(pig.dirY).toBeCloseTo(0);
  });
});
