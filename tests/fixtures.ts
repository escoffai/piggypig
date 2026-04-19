// Shared test fixtures. Build minimal GameState without Phaser.

import { computeBeltLengths } from '../src/systems/BeltSystem';
import { makeSlots } from '../src/systems/WaitingSlotsSystem';
import type {
  BeltConfig,
  BoardConfig,
  Color,
  Cube,
  GameState,
  InventoryEntry,
  Level,
  Pig,
  Waypoint,
} from '../src/types';

export function rectPath(): Waypoint[] {
  return [
    { x: 100, y: 600 },
    { x: 100, y: 200 },
    { x: 500, y: 200 },
    { x: 500, y: 600 },
    { x: 100, y: 600 },
  ];
}

export function makeBelt(overrides: Partial<BeltConfig> = {}): BeltConfig {
  return {
    capacity: 5,
    speed: 200,
    path: rectPath(),
    ...overrides,
  };
}

export function makeBoard(overrides: Partial<BoardConfig> = {}): BoardConfig {
  return {
    originX: 200,
    originY: 300,
    cellSize: 40,
    cols: 6,
    rows: 6,
    ...overrides,
  };
}

export function makeCube(gridX: number, gridY: number, color: Color, id?: string): Cube {
  return { id: id ?? `c-${gridX}-${gridY}`, color, gridX, gridY, hp: 1 };
}

export function makeLevel(options: {
  belt?: BeltConfig;
  board?: BoardConfig;
  cubes?: Cube[];
  inventory?: InventoryEntry[];
} = {}): Level {
  return {
    id: 'test',
    palette: {},
    belt: options.belt ?? makeBelt(),
    board: options.board ?? makeBoard(),
    cubes: options.cubes ?? [],
    inventory: options.inventory ?? [],
    win: { type: 'clearAllCubes' },
  };
}

export function makeState(level: Level): GameState {
  const { segmentLengths, cumulativeLengths, totalLength } = computeBeltLengths(level.belt.path);
  const cubes = new Map<string, Cube>();
  for (const c of level.cubes) cubes.set(`${c.gridX},${c.gridY}`, c);
  return {
    level,
    pigs: [],
    cubes,
    inventory: level.inventory.slice(),
    slots: makeSlots(),
    clearedByColor: {},
    totalCleared: 0,
    beltLength: totalLength,
    segmentLengths,
    cumulativeLengths,
    time: 0,
    status: 'playing',
    rngSeed: 1,
  };
}

export function makePig(options: Partial<Pig> & { color: Color; ammo: number; id?: string }): Pig {
  return {
    id: options.id ?? `pig-test-${Math.random().toString(36).slice(2, 8)}`,
    color: options.color,
    ammo: options.ammo,
    distance: options.distance ?? 0,
    x: options.x ?? 0,
    y: options.y ?? 0,
    dirX: options.dirX ?? 1,
    dirY: options.dirY ?? 0,
    shotCooldown: options.shotCooldown ?? 0,
    chainId: options.chainId,
    ageMs: 0,
    looped: options.looped ?? false,
  };
}

export function makeInvEntry(
  id: string,
  opts: Partial<InventoryEntry> & { ammo: number },
): InventoryEntry {
  return {
    id,
    color: opts.color,
    ammo: opts.ammo,
    chainId: opts.chainId,
    locked: opts.locked,
    hidden: opts.hidden,
  };
}
