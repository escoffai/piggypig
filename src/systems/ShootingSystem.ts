// ShootingSystem: for each pig on belt, raycast perpendicular to travel,
// destroy matching cubes (first along ray; non-matching cubes shield).

import { DEFAULT_SHOT_COOLDOWN_MS } from '../config';
import type { Color, Cube, GameState, Pig, ShotEvent, TickEvents } from '../types';

export function cubeKey(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

export interface HitProbe {
  pig: Pig;
  cube: Cube;
  hitX: number;
  hitY: number;
}

// Cast a ray from pig world position along (rayDx, rayDy). Returns the first
// cube intersected. Non-matching cubes DO occlude; this is the core LOS rule.
export function raycastFirstCube(
  state: GameState,
  startX: number,
  startY: number,
  rayDx: number,
  rayDy: number,
  maxSteps: number,
): Cube | null {
  const board = state.level.board;
  const cellSize = board.cellSize;
  if (cellSize <= 0) return null;

  // Step along the ray in sub-cell increments so we hit the closest grid cell deterministically.
  const step = Math.max(1, cellSize * 0.25);
  const mag = Math.hypot(rayDx, rayDy) || 1;
  const dx = (rayDx / mag) * step;
  const dy = (rayDy / mag) * step;

  let x = startX;
  let y = startY;
  let lastKey = '';
  for (let i = 0; i < maxSteps; i++) {
    x += dx;
    y += dy;
    const gx = Math.floor((x - board.originX) / cellSize);
    const gy = Math.floor((y - board.originY) / cellSize);
    if (gx < 0 || gy < 0 || gx >= board.cols || gy >= board.rows) continue;
    const key = cubeKey(gx, gy);
    if (key === lastKey) continue;
    lastKey = key;
    const cube = state.cubes.get(key);
    if (cube) return cube;
  }
  return null;
}

// Which side(s) of the belt has cubes? For a simple rectangular belt around a board,
// we raycast both perpendicular directions. The GDD says "both sides if the belt
// has cubes on both sides, otherwise the inboard side." In practice casting both
// sides is safe — outside the board the ray finds nothing and the pig simply
// doesn't shoot. So: cast both perpendiculars and take the nearest hit.
export function resolveHits(state: GameState, dtMs: number): TickEvents {
  const shots: ShotEvent[] = [];
  const despawns: TickEvents['despawns'] = [];

  const board = state.level.board;
  const maxSteps = Math.ceil(
    (Math.max(board.cols, board.rows) * board.cellSize * 2) / Math.max(1, board.cellSize * 0.25),
  );

  for (const pig of state.pigs) {
    if (pig.shotCooldown > 0) continue;
    if (pig.ammo <= 0) continue;

    // Perpendicular: rotate direction by +90° and -90°.
    const perpA = { x: -pig.dirY, y: pig.dirX };
    const perpB = { x: pig.dirY, y: -pig.dirX };

    const hitA = raycastFirstCube(state, pig.x, pig.y, perpA.x, perpA.y, maxSteps);
    const hitB = raycastFirstCube(state, pig.x, pig.y, perpB.x, perpB.y, maxSteps);

    type Probe = { cube: Cube; dir: { x: number; y: number } } | null;
    const candidates: Probe[] = [
      hitA ? { cube: hitA, dir: perpA } : null,
      hitB ? { cube: hitB, dir: perpB } : null,
    ];

    // Prefer a matching-color cube (shot-actionable). If both are matching, pick nearer.
    let chosen: Probe = null;
    let chosenDist = Infinity;
    for (const c of candidates) {
      if (!c) continue;
      if (c.cube.color !== pig.color) continue;
      const cx = board.originX + c.cube.gridX * board.cellSize + board.cellSize / 2;
      const cy = board.originY + c.cube.gridY * board.cellSize + board.cellSize / 2;
      const d = Math.hypot(cx - pig.x, cy - pig.y);
      if (d < chosenDist) {
        chosen = c;
        chosenDist = d;
      }
    }

    if (!chosen) continue; // non-matching cube(s) shield; no shot this tick.

    // Fire.
    const cube = chosen.cube;
    const cx = board.originX + cube.gridX * board.cellSize + board.cellSize / 2;
    const cy = board.originY + cube.gridY * board.cellSize + board.cellSize / 2;

    shots.push({
      pigId: pig.id,
      cubeId: cube.id,
      fromX: pig.x,
      fromY: pig.y,
      toX: cx,
      toY: cy,
      color: pig.color,
    });

    destroyCube(state, cube);
    pig.ammo -= 1;
    pig.shotCooldown = DEFAULT_SHOT_COOLDOWN_MS;

    if (pig.ammo <= 0) {
      despawns.push({ pigId: pig.id, x: pig.x, y: pig.y, color: pig.color });
    }
  }

  // Remove despawned pigs from state.pigs.
  if (despawns.length) {
    const ids = new Set(despawns.map((d) => d.pigId));
    state.pigs = state.pigs.filter((p) => !ids.has(p.id));
  }

  // dtMs is unused here (cooldown is advanced in tickBelt).
  void dtMs;

  return { shots, despawns, parked: [] };
}

export function destroyCube(state: GameState, cube: Cube): void {
  state.cubes.delete(cubeKey(cube.gridX, cube.gridY));
  state.clearedByColor[cube.color] = (state.clearedByColor[cube.color] ?? 0) + 1;
  state.totalCleared += 1;
}

export function cubesRemaining(state: GameState): number {
  return state.cubes.size;
}

export function hasAnyMatchingCubeInLOS(state: GameState, color: Color): boolean {
  // Used by WinFailSystem fail check: are there ANY cubes of this color currently on-board
  // that a pig traveling the belt could ever shoot? Since the belt is a loop and cubes only
  // get cleared (never added), a simpler proxy is: does any cube of that color remain?
  for (const cube of state.cubes.values()) {
    if (cube.color === color) return true;
  }
  return false;
}
