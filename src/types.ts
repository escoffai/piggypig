// Shared domain types for Pixel Flow. Pure data, no Phaser imports.

export type Color =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'white'
  | 'black';

export type LockCondition = string;

export interface InventoryEntry {
  id: string;
  color?: Color;
  ammo: number;
  chainId?: string;
  locked?: LockCondition;
  hidden?: boolean;
}

export interface Pig {
  id: string;
  color: Color;
  ammo: number;
  // Position along the belt polyline, in cumulative arc-length from path[0].
  distance: number;
  // Cache of current world position and unit direction.
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  shotCooldown: number;
  chainId?: string;
  // Milliseconds since spawn; used for short shield/grace or render effects.
  ageMs: number;
  // Has the pig completed at least one full loop (>= beltLength)?
  looped: boolean;
}

export interface Cube {
  id: string;
  color: Color;
  gridX: number;
  gridY: number;
  hp: number;
}

export interface Waypoint {
  x: number;
  y: number;
}

export interface BeltConfig {
  capacity: number;
  speed: number; // pixels per second
  path: Waypoint[];
}

export interface BoardConfig {
  // World position of cube grid origin (top-left), in the same coordinate space as belt waypoints.
  originX: number;
  originY: number;
  cellSize: number;
  cols: number;
  rows: number;
}

export interface WinCondition {
  type: 'clearAllCubes';
}

export interface Level {
  id: string;
  title?: string;
  image?: string;
  palette: Record<string, Color>;
  belt: BeltConfig;
  board: BoardConfig;
  cubes: Cube[];
  inventory: InventoryEntry[];
  win: WinCondition;
}

export interface Slot {
  pig: Pig | null;
}

export interface GameState {
  level: Level;
  pigs: Pig[];
  cubes: Map<string, Cube>; // keyed by `${gridX},${gridY}`
  inventory: InventoryEntry[]; // consumed front-to-back
  slots: Slot[]; // exactly 5
  clearedByColor: Partial<Record<Color, number>>;
  totalCleared: number;
  beltLength: number; // cached cumulative arc length
  segmentLengths: number[];
  cumulativeLengths: number[];
  time: number; // elapsed ms
  status: 'playing' | 'won' | 'lost';
  rngSeed: number;
}

export interface DeployResult {
  deployed: Pig[];
  reason?: 'ok' | 'capacity' | 'locked' | 'empty' | 'hidden-not-front';
}

export interface ShotEvent {
  pigId: string;
  cubeId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: Color;
}

export interface PigDespawnEvent {
  pigId: string;
  x: number;
  y: number;
  color: Color;
}

export interface TickEvents {
  shots: ShotEvent[];
  despawns: PigDespawnEvent[];
  parked: { slotIndex: number; pig: Pig }[];
}
