import { describe, expect, it } from 'vitest';
import { resolveHits } from '../src/systems/ShootingSystem';
import { makeBoard, makeCube, makeLevel, makePig, makeState } from './fixtures';

describe('ShootingSystem.resolveHits', () => {
  it('destroys first cube in LOS when color matches', () => {
    const board = makeBoard({ originX: 200, originY: 300, cellSize: 40, cols: 6, rows: 6 });
    const level = makeLevel({
      board,
      cubes: [makeCube(2, 2, 'green')], // cube center at (200 + 2*40 + 20, 300 + 2*40 + 20) = (300, 400)
    });
    const state = makeState(level);
    // Place a pig at world (100, 400), moving up; perpendicular (+x) points at the cube.
    const pig = makePig({ color: 'green', ammo: 3, x: 100, y: 400, dirX: 0, dirY: -1 });
    state.pigs.push(pig);
    pig.shotCooldown = 0;
    const events = resolveHits(state, 16);
    expect(events.shots).toHaveLength(1);
    expect(state.cubes.size).toBe(0);
    expect(pig.ammo).toBe(2);
  });

  it('non-matching cube shields the ray (no shot)', () => {
    const board = makeBoard({ originX: 0, originY: 300, cellSize: 40, cols: 6, rows: 6 });
    const level = makeLevel({
      board,
      cubes: [
        makeCube(3, 2, 'red'), // closer to pig (blocker)
        makeCube(5, 2, 'green'), // behind
      ],
    });
    const state = makeState(level);
    // pig at (-100, 420), perpendicular (+x)
    const pig = makePig({ color: 'green', ammo: 3, x: -100, y: 420, dirX: 0, dirY: -1 });
    state.pigs.push(pig);
    pig.shotCooldown = 0;
    const events = resolveHits(state, 16);
    expect(events.shots).toHaveLength(0);
    expect(state.cubes.size).toBe(2);
    expect(pig.ammo).toBe(3);
  });

  it('empty ray (no cubes) produces no shot', () => {
    const level = makeLevel({ cubes: [] });
    const state = makeState(level);
    const pig = makePig({ color: 'red', ammo: 2, x: 0, y: 0, dirX: 1, dirY: 0 });
    state.pigs.push(pig);
    pig.shotCooldown = 0;
    const events = resolveHits(state, 16);
    expect(events.shots).toHaveLength(0);
    expect(pig.ammo).toBe(2);
  });

  it('despawns pig when ammo hits 0', () => {
    const board = makeBoard({ originX: 200, originY: 300, cellSize: 40, cols: 6, rows: 6 });
    const level = makeLevel({
      board,
      cubes: [makeCube(2, 2, 'blue')],
    });
    const state = makeState(level);
    const pig = makePig({
      color: 'blue',
      ammo: 1,
      x: 100,
      y: 400,
      dirX: 0,
      dirY: -1,
      id: 'solo',
    });
    state.pigs.push(pig);
    pig.shotCooldown = 0;
    const events = resolveHits(state, 16);
    expect(events.despawns).toHaveLength(1);
    expect(events.despawns[0].pigId).toBe('solo');
    expect(state.pigs.find((p) => p.id === 'solo')).toBeUndefined();
  });

  it('respects shot cooldown (no shot while cooling down)', () => {
    const board = makeBoard({ originX: 200, originY: 300, cellSize: 40, cols: 6, rows: 6 });
    const level = makeLevel({
      board,
      cubes: [makeCube(2, 2, 'yellow')],
    });
    const state = makeState(level);
    const pig = makePig({
      color: 'yellow',
      ammo: 2,
      x: 100,
      y: 400,
      dirX: 0,
      dirY: -1,
      shotCooldown: 50,
    });
    state.pigs.push(pig);
    const events = resolveHits(state, 16);
    expect(events.shots).toHaveLength(0);
    expect(pig.ammo).toBe(2);
  });
});
