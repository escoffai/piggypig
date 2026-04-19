// Lock condition parser + evaluator.
//
// Supported grammars:
//   cubesOfColorCleared:<color>:<n>
//   slotsFree:>=<n>
//   beltEmpty
//   cubesRemaining:<=<n>
//
// Evaluator returns true when the condition is satisfied.

import type { Color, GameState } from '../types';

export function evaluateLock(state: GameState, condition: string): boolean {
  const trimmed = condition.trim();
  if (trimmed === 'beltEmpty') {
    return state.pigs.length === 0;
  }
  const parts = trimmed.split(':');
  const head = parts[0];
  switch (head) {
    case 'cubesOfColorCleared': {
      const color = parts[1] as Color | undefined;
      const n = Number(parts[2]);
      if (!color || Number.isNaN(n)) return false;
      return (state.clearedByColor[color] ?? 0) >= n;
    }
    case 'slotsFree': {
      const expr = parts[1] ?? '';
      const free = state.slots.filter((s) => s.pig == null).length;
      return compareOp(expr, free);
    }
    case 'cubesRemaining': {
      const expr = parts[1] ?? '';
      return compareOp(expr, state.cubes.size);
    }
    default:
      return false;
  }
}

// Accepts strings like ">=3", "<=0", "=4", "3" (treated as "=3"), ">1", "<5".
function compareOp(expr: string, value: number): boolean {
  const match = expr.match(/^(>=|<=|=|>|<)?(\d+)$/);
  if (!match) return false;
  const op = match[1] ?? '=';
  const n = Number(match[2]);
  switch (op) {
    case '>=':
      return value >= n;
    case '<=':
      return value <= n;
    case '>':
      return value > n;
    case '<':
      return value < n;
    case '=':
      return value === n;
    default:
      return false;
  }
}
