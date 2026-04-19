// Level loader: take level JSON + decoded pixel image, build a fully-initialized GameState.

import { computeBeltLengths } from '../systems/BeltSystem';
import { makeSlots } from '../systems/WaitingSlotsSystem';
import { cubesFromImage, type PixelImage } from './pngLevelLoader';
import type {
  BeltConfig,
  BoardConfig,
  Color,
  Cube,
  GameState,
  InventoryEntry,
  Level,
  WinCondition,
} from '../types';

export interface LevelJson {
  id: string;
  title?: string;
  image?: string;
  palette: Record<string, Color>;
  belt: BeltConfig;
  board: Partial<BoardConfig> & { originX: number; originY: number; cellSize: number };
  inventory: Array<{
    color?: Color;
    ammo: number;
    chainId?: string;
    locked?: string;
    hidden?: boolean;
  }>;
  win: WinCondition;
}

let entrySeq = 1;
function nextEntryId(): string {
  return `inv-${entrySeq++}`;
}

export function buildLevel(json: LevelJson, img: PixelImage): Level {
  const cubes = cubesFromImage(img, json.palette);
  const board: BoardConfig = {
    originX: json.board.originX,
    originY: json.board.originY,
    cellSize: json.board.cellSize,
    cols: img.width,
    rows: img.height,
  };
  const inventory: InventoryEntry[] = json.inventory.map((e) => ({
    id: nextEntryId(),
    color: e.color,
    ammo: e.ammo,
    chainId: e.chainId,
    locked: e.locked,
    hidden: e.hidden,
  }));
  return {
    id: json.id,
    title: json.title,
    image: json.image,
    palette: json.palette,
    belt: json.belt,
    board,
    cubes,
    inventory,
    win: json.win,
  };
}

export function cubesIntoMap(cubes: Cube[]): Map<string, Cube> {
  const m = new Map<string, Cube>();
  for (const c of cubes) m.set(`${c.gridX},${c.gridY}`, c);
  return m;
}

export function initialState(level: Level): GameState {
  const { segmentLengths, cumulativeLengths, totalLength } = computeBeltLengths(level.belt.path);
  return {
    level,
    pigs: [],
    cubes: cubesIntoMap(level.cubes),
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
