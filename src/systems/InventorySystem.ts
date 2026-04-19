// InventorySystem: tap-to-deploy, hidden reveal, chain all-or-nothing, lock gating.

import { DEFAULT_SHOT_COOLDOWN_MS } from '../config';
import { canDeploy, spawnPigOnBelt } from './BeltSystem';
import { evaluateLock } from './Locks';
import type { Color, DeployResult, GameState, InventoryEntry, Pig } from '../types';

let pigIdSeq = 1;
export function resetPigIdSeq(n = 1): void {
  pigIdSeq = n;
}
export function nextPigId(): string {
  return `pig-${pigIdSeq++}`;
}

// Is this entry effectively tappable right now?
export function isEntryTappable(state: GameState, entry: InventoryEntry): boolean {
  if (entry.hidden && !isFrontOfHidden(state, entry)) return false;
  if (entry.locked && !evaluateLock(state, entry.locked)) return false;
  return true;
}

// A hidden pig is only tappable when it's the front of the queue (all entries before it consumed).
function isFrontOfHidden(state: GameState, entry: InventoryEntry): boolean {
  const idx = state.inventory.indexOf(entry);
  if (idx < 0) return false;
  return idx === 0;
}

export function revealHiddenIfAtFront(state: GameState): void {
  const first = state.inventory[0];
  if (first && first.hidden) {
    first.hidden = false;
    // Color must already be set by the level author (hidden only hides it visually).
  }
}

function makePigFromEntry(entry: InventoryEntry, distanceOnBelt = 0): Pig {
  const color = entry.color;
  if (!color) {
    throw new Error(`Inventory entry ${entry.id} has no color. Hidden pigs must set a color.`);
  }
  return {
    id: nextPigId(),
    color,
    ammo: entry.ammo,
    distance: distanceOnBelt,
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    shotCooldown: DEFAULT_SHOT_COOLDOWN_MS,
    chainId: entry.chainId,
    ageMs: 0,
    looped: false,
  };
}

// Collect every inventory entry sharing the same chainId as `entry`,
// in their original inventory order.
function collectChain(state: GameState, entry: InventoryEntry): InventoryEntry[] {
  if (!entry.chainId) return [entry];
  return state.inventory.filter((e) => e.chainId === entry.chainId);
}

// Deploy from the inventory: consume the entry/chain and spawn pigs on the belt.
// Front-of-queue semantics: hidden entries only reveal at index 0.
export function deployFromInventory(state: GameState, entryId: string): DeployResult {
  const entry = state.inventory.find((e) => e.id === entryId);
  if (!entry) return { deployed: [], reason: 'empty' };

  // Hidden-at-front gate: can only deploy a hidden pig if it's already been revealed
  // (i.e. it has bubbled to the front and we called revealHiddenIfAtFront on it).
  if (entry.hidden) {
    if (state.inventory[0] !== entry) return { deployed: [], reason: 'hidden-not-front' };
    revealHiddenIfAtFront(state);
  }

  if (entry.locked && !evaluateLock(state, entry.locked)) {
    return { deployed: [], reason: 'locked' };
  }

  const chain = collectChain(state, entry);
  if (!canDeploy(state, chain.length)) {
    return { deployed: [], reason: 'capacity' };
  }

  // Spawn each chain member spaced slightly along the belt so they don't overlap.
  const spacing = 28;
  const deployed: Pig[] = [];
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    // Hidden members of a chain: reveal their color at deploy time (same tick).
    if (e.hidden) e.hidden = false;
    const pig = makePigFromEntry(e, -i * spacing);
    spawnPigOnBelt(state, pig);
    deployed.push(pig);
  }

  // Remove chain entries from inventory.
  state.inventory = state.inventory.filter((e) => !chain.includes(e));

  // After mutating inventory, reveal any new hidden entry now at front.
  revealHiddenIfAtFront(state);

  return { deployed, reason: 'ok' };
}

// Utility: how many entries are currently tappable?
export function countTappable(state: GameState): number {
  let n = 0;
  for (const e of state.inventory) {
    if (isEntryTappable(state, e)) n++;
  }
  return n;
}

export function inventoryColors(state: GameState): Color[] {
  return state.inventory.filter((e) => !!e.color).map((e) => e.color as Color);
}
