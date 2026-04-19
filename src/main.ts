// Phaser bootstrap. Portrait 9:16 logical canvas; FIT scale for mobile/desktop.

import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { LevelScene } from './scenes/LevelScene';
import { TitleScene } from './scenes/TitleScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1120',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  },
  scene: [BootScene, TitleScene, LevelScene, UIScene],
  render: {
    pixelArt: false,
    antialias: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  input: {
    activePointers: 1,
  },
};

new Phaser.Game(config);

// Register the service worker in production only. Vite sets import.meta.env.DEV=true
// during `npm run dev`; a live SW would interfere with HMR there.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    const base = (import.meta.env.BASE_URL ?? './').replace(/\/?$/, '/');
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // SW registration is best-effort; game works without it.
    });
  });
}
