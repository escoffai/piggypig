import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isColorBlind,
  isLevelUnlocked,
  loadProgress,
  markTutorialSeen,
  recordLevelCleared,
  saveProgress,
  setColorBlind,
} from '../src/systems/Progress';

// In-memory localStorage stub.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  const ls = {
    getItem(k: string): string | null {
      return store.has(k) ? (store.get(k) as string) : null;
    },
    setItem(k: string, v: string): void {
      store.set(k, v);
    },
    removeItem(k: string): void {
      store.delete(k);
    },
    clear(): void {
      store.clear();
    },
    key(i: number): string | null {
      return Array.from(store.keys())[i] ?? null;
    },
    get length(): number {
      return store.size;
    },
  };
  vi.stubGlobal('window', { localStorage: ls });
}

beforeEach(() => {
  installLocalStorage();
});

describe('Progress', () => {
  it('starts blank when nothing persisted', () => {
    const p = loadProgress();
    expect(p.levels).toEqual({});
    expect(p.tutorial).toEqual({ inventorySeen: false, slotSeen: false });
  });

  it('recordLevelCleared persists cleared + stars, keeping best star count', () => {
    recordLevelCleared('level-01', 2);
    let p = loadProgress();
    expect(p.levels['level-01']).toEqual({ cleared: true, stars: 2 });
    recordLevelCleared('level-01', 1); // worse; should not downgrade
    p = loadProgress();
    expect(p.levels['level-01'].stars).toBe(2);
    recordLevelCleared('level-01', 3);
    p = loadProgress();
    expect(p.levels['level-01'].stars).toBe(3);
  });

  it('isLevelUnlocked gates by previous-level clear', () => {
    const manifest = ['a', 'b', 'c'];
    expect(isLevelUnlocked(manifest, 'a')).toBe(true);
    expect(isLevelUnlocked(manifest, 'b')).toBe(false);
    recordLevelCleared('a', 2);
    expect(isLevelUnlocked(manifest, 'b')).toBe(true);
    expect(isLevelUnlocked(manifest, 'c')).toBe(false);
    recordLevelCleared('b', 1);
    expect(isLevelUnlocked(manifest, 'c')).toBe(true);
  });

  it('markTutorialSeen toggles flags', () => {
    markTutorialSeen('inventory');
    expect(loadProgress().tutorial.inventorySeen).toBe(true);
    markTutorialSeen('slot');
    expect(loadProgress().tutorial.slotSeen).toBe(true);
  });

  it('setColorBlind round-trips through storage', () => {
    expect(isColorBlind()).toBe(false);
    setColorBlind(true);
    expect(isColorBlind()).toBe(true);
    expect(loadProgress().settings.colorBlind).toBe(true);
    setColorBlind(false);
    expect(isColorBlind()).toBe(false);
  });

  it('survives corrupt JSON by returning blank', () => {
    saveProgress({
      levels: { a: { cleared: true, stars: 3 } },
      tutorial: { inventorySeen: true, slotSeen: true },
      settings: { colorBlind: true },
    });
    window.localStorage.setItem('pixel-flow-progress-v1', '{broken');
    const p = loadProgress();
    expect(p.levels).toEqual({});
    expect(p.tutorial.inventorySeen).toBe(false);
  });
});
