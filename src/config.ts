// Tuning constants, palette, and other shared configuration.

import type { Color } from './types';

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

export const LOGICAL_WIDTH = 720;
export const LOGICAL_HEIGHT = 1280;

export const DEFAULT_SHOT_COOLDOWN_MS = 140;
export const PROJECTILE_SPEED = 1400; // px/s, visual only

// UI layout (in logical px).
export const SLOT_COUNT = 5;
export const SLOT_SIZE = 96;
export const SLOT_GAP = 12;
export const INVENTORY_TILE = 96;
export const INVENTORY_GAP = 10;

export const COLOR_HEX: Record<Color, number> = {
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  yellow: 0xf1c40f,
  pink: 0xe91e63,
  purple: 0x9b59b6,
  orange: 0xe67e22,
  white: 0xfefefe,
  black: 0x111111,
};

export const COLOR_CSS: Record<Color, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f',
  pink: '#e91e63',
  purple: '#9b59b6',
  orange: '#e67e22',
  white: '#fefefe',
  black: '#111111',
};

export const BACKGROUND_HEX = 0x0b1120;
export const BELT_HEX = 0x2c3b55;
export const BELT_EDGE_HEX = 0x5978a6;
export const SLOT_BG_HEX = 0x1e293b;
export const INVENTORY_BG_HEX = 0x142038;
