// Progress persistence: per-level cleared flag + star rating, plus global
// accessibility settings. Stored in localStorage; gracefully no-ops outside
// the browser.

export interface LevelProgress {
  cleared: boolean;
  stars: number;
}

export interface Settings {
  colorBlind: boolean;
}

export interface Progress {
  levels: Record<string, LevelProgress>;
  tutorial: { inventorySeen: boolean; slotSeen: boolean };
  settings: Settings;
}

const KEY = 'pixel-flow-progress-v1';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function blank(): Progress {
  return {
    levels: {},
    tutorial: { inventorySeen: false, slotSeen: false },
    settings: { colorBlind: false },
  };
}

export function loadProgress(): Progress {
  const s = safeStorage();
  if (!s) return blank();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      levels: parsed.levels ?? {},
      tutorial: {
        inventorySeen: !!parsed.tutorial?.inventorySeen,
        slotSeen: !!parsed.tutorial?.slotSeen,
      },
      settings: {
        colorBlind: !!parsed.settings?.colorBlind,
      },
    };
  } catch {
    return blank();
  }
}

export function saveProgress(p: Progress): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(p));
  } catch {
    // quota or denied; ignore
  }
}

export function recordLevelCleared(levelId: string, stars: number): Progress {
  const p = loadProgress();
  const existing = p.levels[levelId];
  // Keep the best star count.
  const best = Math.max(existing?.stars ?? 0, stars);
  p.levels[levelId] = { cleared: true, stars: best };
  saveProgress(p);
  return p;
}

export function markTutorialSeen(kind: 'inventory' | 'slot'): Progress {
  const p = loadProgress();
  if (kind === 'inventory') p.tutorial.inventorySeen = true;
  else p.tutorial.slotSeen = true;
  saveProgress(p);
  return p;
}

export function setColorBlind(on: boolean): Progress {
  const p = loadProgress();
  p.settings.colorBlind = on;
  saveProgress(p);
  return p;
}

export function isColorBlind(): boolean {
  return loadProgress().settings.colorBlind;
}

export function isLevelUnlocked(
  manifestOrder: string[],
  levelId: string,
  progress = loadProgress(),
): boolean {
  const idx = manifestOrder.indexOf(levelId);
  if (idx <= 0) return true; // first level always unlocked
  const prev = manifestOrder[idx - 1];
  return !!progress.levels[prev]?.cleared;
}
