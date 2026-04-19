// WinFailSystem: evaluate win/fail predicates from GDD §9.

import { canDeploy } from './BeltSystem';
import { isEntryTappable } from './InventorySystem';
import { slotsAllFull } from './WaitingSlotsSystem';
import type { Color, GameState } from '../types';

export type Outcome = 'playing' | 'won' | 'lost';

export function evaluate(state: GameState): Outcome {
  if (state.cubes.size === 0) return 'won';

  const onBelt = state.pigs.length;

  // Branch A (nothing to deploy and nothing on belt):
  //   onBelt == 0 AND slotsAllEmpty AND no tappable inventory entry.
  const allSlotsEmpty = state.slots.every((s) => s.pig == null);
  if (onBelt === 0 && allSlotsEmpty) {
    let anyTappable = false;
    for (const entry of state.inventory) {
      if (isEntryTappable(state, entry)) {
        anyTappable = true;
        break;
      }
    }
    if (!anyTappable) return 'lost';
  }

  // Branch B (stuck with full slots and no belt progress):
  //   slotsAllFull AND !canDeploy(1) (belt full) AND no belt pig will ever hit a matching cube.
  if (slotsAllFull(state) && !canDeploy(state, 1)) {
    if (!anyBeltPigHasReachableMatch(state)) return 'lost';
  }

  // Branch C (a more general dead-end detector): if NO pig anywhere (belt, slots, inventory)
  // can ever eliminate any remaining cube color, the board is unwinnable.
  const coloredAssets = new Set<Color>();
  for (const pig of state.pigs) coloredAssets.add(pig.color);
  for (const slot of state.slots) if (slot.pig) coloredAssets.add(slot.pig.color);
  for (const entry of state.inventory) if (entry.color) coloredAssets.add(entry.color);

  const remainingColors = new Set<Color>();
  for (const cube of state.cubes.values()) remainingColors.add(cube.color);

  let covered = true;
  for (const c of remainingColors) {
    if (!coloredAssets.has(c)) {
      covered = false;
      break;
    }
  }
  if (!covered) return 'lost';

  return 'playing';
}

// Heuristic: are there any matching cubes remaining for ANY pig currently on belt?
// The belt is a closed loop, so if a matching cube exists at all, the pig will
// eventually pass it in LOS. This keeps the check cheap.
function anyBeltPigHasReachableMatch(state: GameState): boolean {
  const beltColors = new Set<Color>();
  for (const pig of state.pigs) beltColors.add(pig.color);
  for (const cube of state.cubes.values()) {
    if (beltColors.has(cube.color)) return true;
  }
  return false;
}

export function applyOutcome(state: GameState): void {
  state.status = evaluate(state);
}
