// BootScene: preload level manifest + audio, then hand off to TitleScene.

import Phaser from 'phaser';

export interface LevelManifestEntry {
  id: string;
  title: string;
  json: string;
  png: string;
}

export const LEVEL_MANIFEST: LevelManifestEntry[] = [
  { id: 'level-01', title: '1 · First Flow', json: 'levels/level-01.json', png: 'levels/level-01.png' },
  { id: 'level-02', title: '2 · Cactus', json: 'levels/level-02.json', png: 'levels/level-02.png' },
  { id: 'level-03', title: '3 · Butterfly', json: 'levels/level-03.json', png: 'levels/level-03.png' },
  { id: 'level-04', title: '4 · Smoothie', json: 'levels/level-04.json', png: 'levels/level-04.png' },
  { id: 'level-05', title: '5 · Princess', json: 'levels/level-05.json', png: 'levels/level-05.png' },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.setBaseURL(import.meta.env.BASE_URL ?? './');
    for (const entry of LEVEL_MANIFEST) {
      this.load.json(`${entry.id}.json`, entry.json);
      this.load.image(`${entry.id}.png`, entry.png);
    }
  }

  create(): void {
    this.registry.set('levelManifest', LEVEL_MANIFEST);
    this.registry.set('muted', false);
    this.scene.start('TitleScene');
  }
}
