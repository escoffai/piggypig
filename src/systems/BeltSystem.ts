// BeltSystem: advance pigs along the belt polyline at constant speed.
// Computes arc-length, world position, and direction. No Phaser imports.

import type { GameState, Pig, Waypoint } from '../types';

export function computeBeltLengths(path: Waypoint[]): {
  segmentLengths: number[];
  cumulativeLengths: number[];
  totalLength: number;
} {
  if (path.length < 2) {
    return { segmentLengths: [], cumulativeLengths: [0], totalLength: 0 };
  }
  const segmentLengths: number[] = [];
  const cumulativeLengths: number[] = [0];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    total += len;
    cumulativeLengths.push(total);
  }
  return { segmentLengths, cumulativeLengths, totalLength: total };
}

export function sampleBelt(
  path: Waypoint[],
  cumulativeLengths: number[],
  totalLength: number,
  distance: number,
): { x: number; y: number; dirX: number; dirY: number; segmentIndex: number } {
  if (totalLength <= 0 || path.length < 2) {
    const p = path[0] ?? { x: 0, y: 0 };
    return { x: p.x, y: p.y, dirX: 1, dirY: 0, segmentIndex: 0 };
  }
  // Wrap to [0, totalLength). Belt is a closed loop when path[0]==path[last].
  let d = distance % totalLength;
  if (d < 0) d += totalLength;
  // Find segment via linear scan (belt polylines are short).
  let seg = 0;
  for (let i = 0; i < cumulativeLengths.length - 1; i++) {
    if (d >= cumulativeLengths[i] && d < cumulativeLengths[i + 1]) {
      seg = i;
      break;
    }
    if (i === cumulativeLengths.length - 2) {
      seg = i;
    }
  }
  const segStart = cumulativeLengths[seg];
  const segEnd = cumulativeLengths[seg + 1];
  const segLen = segEnd - segStart || 1;
  const t = (d - segStart) / segLen;
  const a = path[seg];
  const b = path[seg + 1];
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy) || 1;
  return { x, y, dirX: dx / mag, dirY: dy / mag, segmentIndex: seg };
}

export function spawnPigOnBelt(state: GameState, pig: Pig): void {
  const sampled = sampleBelt(
    state.level.belt.path,
    state.cumulativeLengths,
    state.beltLength,
    pig.distance,
  );
  pig.x = sampled.x;
  pig.y = sampled.y;
  pig.dirX = sampled.dirX;
  pig.dirY = sampled.dirY;
  state.pigs.push(pig);
}

// Advance every pig by dtMs at belt speed. Marks pigs that have completed a loop.
// Does NOT remove looped pigs; WaitingSlotsSystem.parkLoopedPigs handles that.
export function tickBelt(state: GameState, dtMs: number): void {
  const dtSec = dtMs / 1000;
  const speed = state.level.belt.speed;
  const path = state.level.belt.path;
  const cum = state.cumulativeLengths;
  const total = state.beltLength;
  const advance = speed * dtSec;
  for (const pig of state.pigs) {
    const previousDistance = pig.distance;
    pig.distance += advance;
    // If pig crossed the total length, it has completed a loop.
    if (previousDistance < total && pig.distance >= total) {
      pig.looped = true;
    }
    const sampled = sampleBelt(path, cum, total, pig.distance);
    pig.x = sampled.x;
    pig.y = sampled.y;
    pig.dirX = sampled.dirX;
    pig.dirY = sampled.dirY;
    pig.ageMs += dtMs;
    if (pig.shotCooldown > 0) {
      pig.shotCooldown = Math.max(0, pig.shotCooldown - dtMs);
    }
  }
}

export function canDeploy(state: GameState, count = 1): boolean {
  return state.pigs.length + count <= state.level.belt.capacity;
}

export function onBeltCount(state: GameState): number {
  return state.pigs.length;
}
