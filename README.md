# Pixel Flow

A casual, one-tap mobile puzzle game. Tap colored pigs onto a looping conveyor belt; each pig automatically shoots matching pixel cubes perpendicular to its travel. Manage belt capacity and 5 waiting slots to clear the picture.

Built with **Phaser 3 + TypeScript (strict) + Vite**, portrait-first for mobile web, with a pure-data systems core that is unit-tested independent of Phaser.

See **[`GDD.md`](./GDD.md)** for the full design reference and **[`PROMPT.md`](./PROMPT.md)** for the engineering brief.

---

## Quick start

```bash
npm install
npm run dev       # start the dev server at http://localhost:5173
npm run test      # run Vitest unit tests
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
npm run lint      # eslint
```

Requires Node 18+. CI runs on every push and PR via `.github/workflows/ci.yml`
(lint + test + build + dist artifact upload).

---

## How the game is wired

The design splits cleanly into two halves:

### Pure domain (unit-testable, no Phaser)

Found under `src/systems/` and `src/types.ts`. Each system is a set of plain
functions operating on a `GameState`:

| System              | Responsibility                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| `BeltSystem`        | Polyline belt: advance pigs along arc-length at constant speed, report direction.  |
| `ShootingSystem`    | Perpendicular LOS raycast; non-matching cubes shield. Decrements ammo, despawns 0. |
| `InventorySystem`   | Deploy: capacity gate, chain all-or-nothing, lock gating, hidden reveal at front.  |
| `WaitingSlotsSystem`| Park looped pigs leftmost-first; redeploy subject to capacity.                     |
| `WinFailSystem`     | Win when cubes empty. Loss when no asset can ever clear remaining cube colors.     |
| `Locks`             | Parser/evaluator for lock-condition grammar (see §Authoring).                      |
| `SoundSystem`       | Synthesized WebAudio SFX (shot, pop, fanfare, sting) + haptic pulse.               |

### Render layer (Phaser)

Found under `src/scenes/` and `src/entities/`. The `LevelScene` drives a fixed
60 Hz logical tick independent of render framerate, consumes tick events, and
issues Phaser tweens/particles for VFX. `UIScene` runs in parallel for HUD
overlay: capacity readout, 5 slots, inventory grid, quit/settings.

```
BootScene → TitleScene → LevelScene + UIScene (parallel) → Result panel → Next/Retry
```

---

## Authoring a new level

Each level is two files under `levels/`:

1. **`levels/<id>.png`** — a pixel-art picture where each non-transparent pixel
   is one cube. Grid dimensions = image dimensions. Authored in any pixel-art
   editor (Aseprite, Piskel, Photoshop), OR generated from ASCII via
   `scripts/gen-levels.mjs`.
2. **`levels/<id>.json`** — level configuration.

```jsonc
{
  "id": "level-06",
  "title": "My Level",
  "image": "levels/level-06.png",
  "palette": {
    "#e74c3c": "red",
    "#2ecc71": "green",
    "#3498db": "blue"
    // … any of the 9 supported colors
  },
  "belt": {
    "capacity": 3,
    "speed": 240,
    "path": [
      { "x": 100, "y": 700 },
      { "x": 100, "y": 220 },
      { "x": 620, "y": 220 },
      { "x": 620, "y": 700 },
      { "x": 100, "y": 700 } // closed loop
    ]
  },
  "board": {
    "originX": 192,
    "originY": 300,
    "cellSize": 56
  },
  "inventory": [
    { "color": "green", "ammo": 16 },
    { "color": "red",   "ammo": 8, "chainId": "c1" },
    { "color": "red",   "ammo": 8, "chainId": "c1" },
    { "color": "blue",  "ammo": 4, "hidden": true },
    { "color": "pink",  "ammo": 1, "locked": "cubesOfColorCleared:blue:4" }
  ],
  "win": { "type": "clearAllCubes" }
}
```

Then add the level to `LEVEL_MANIFEST` in `src/scenes/BootScene.ts`.

### Colors

`red`, `blue`, `green`, `yellow`, `pink`, `purple`, `orange`, `white`, `black`.

### Modifiers

| Modifier    | Field                          | Behavior                                                                         |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------- |
| Hidden `?`  | `"hidden": true`               | Color hidden until this pig is front-of-queue, then reveals.                     |
| Chain       | `"chainId": "c1"`              | All entries sharing this id deploy on one tap (all-or-nothing vs. capacity).     |
| Lock        | `"locked": "<condition>"`      | Untappable until the condition evaluates true.                                   |

### Lock condition grammar

```
cubesOfColorCleared:<color>:<n>    at least n cubes of given color destroyed
slotsFree:<op><n>                  waiting slots free (op ∈ >= <= > < =)
beltEmpty                          no pigs currently on belt
cubesRemaining:<op><n>             cubes remaining on board
```

### Regenerate PNGs from ASCII

```bash
node scripts/gen-levels.mjs
```

Edit the `LEVELS` array at the bottom of that script to add/modify ASCII grids.
Glyphs: `R B G Y P U O W K .` → red blue green yellow pink purple orange white
black transparent.

---

## Repository layout

```
piggypig/
├── GDD.md                  design reference (canonical)
├── PROMPT.md               engineering brief
├── README.md               (this file)
├── index.html              entry HTML
├── package.json
├── tsconfig.json           strict TypeScript
├── vite.config.ts          also includes the plugin that serves levels/
├── .eslintrc.cjs
├── .prettierrc
├── src/
│   ├── main.ts             Phaser bootstrap
│   ├── types.ts            domain types (Pig, Cube, Level, GameState, …)
│   ├── config.ts           tuning constants + palette hexes
│   ├── scenes/             Boot, Title, Level, UI (Phaser)
│   ├── systems/            pure domain systems (unit-tested)
│   ├── entities/           render adapters for Pig / Cube
│   └── loaders/            level JSON + PNG pixel loader
├── levels/                 shipped level PNG + JSON pairs
├── scripts/
│   └── gen-levels.mjs      optional ASCII → PNG generator
└── tests/                  Vitest suites (no Phaser)
```

---

## Tech decisions

- **Pure systems, Phaser only at the edges.** Every game rule lives in a plain
  function. Tests exercise them without a DOM, without WebGL, in milliseconds.
- **Fixed-step 60 Hz tick.** `LevelScene.update` accumulates delta into 16.67 ms
  ticks; render sync happens once per frame. Deterministic, jitter-free.
- **Closed-loop belt as arc-length.** Pigs carry a scalar `distance`; their
  world position and unit direction are sampled from the polyline per tick.
  Looping is just `distance % totalLength`. This makes shot-direction math
  trivial — shoot perpendicular to the unit direction.
- **LOS via grid-stepped raycast.** No physics engine. Non-matching cubes
  shield the ray; this is how outer layers force the player to peel inner cores.
- **WebAudio-synthesized SFX.** Zero audio-asset binaries. Tones are short and
  snappy, honoring the “pew-pew” cadence in the GDD.
- **Single plugin serves `levels/` in dev and copies to dist on build**, so the
  repo layout stays exactly as specified in `PROMPT.md` while still working
  under Vite.

---

## Running the tests

```bash
npm run test
```

Coverage spans three layers:

- **Pure systems** (Belt, Shooting, Inventory, WaitingSlots, WinFail, Locks,
  Progress) — every branch of the GDD rules.
- **Loaders** — PNG pixel decode → cube grid.
- **End-to-end solvability** — a Vitest integration suite loads every shipped
  level off disk, feeds it to a greedy auto-player, and asserts `status === 'won'`
  under the sim. This catches any ammo/capacity miscalibration before a human
  ever sees the level.

## Accessibility

An **A11y** toggle in the HUD turns on a per-color geometric glyph overlay —
circle, square, triangle, diamond, plus, cross, inverted triangle, ring, bar —
so the game is playable without relying on hue alone. The setting persists in
localStorage and live-refreshes every cube, pig, slot and inventory tile the
moment it's toggled. Each glyph is rendered in a contrasting monochrome against
its cube color so it remains legible regardless of display calibration.

## PWA / offline install

- `public/manifest.webmanifest` + `public/sw.js` wire up installability and
  offline play. Shipped icons are generated by `scripts/gen-icons.mjs`.
- In production, `src/main.ts` registers the service worker under the correct
  `BASE_URL` (works on both root and subpath deploys like GitHub Pages).
- The SW is cache-first with a stale-while-revalidate refresh, so levels,
  bundle, and the SPA shell load instantly on repeat visits and also work
  fully offline. Dev mode intentionally skips SW registration so HMR is not
  shadowed.
- On iOS Safari / Android Chrome, "Add to Home Screen" yields a chromeless,
  portrait-locked install of Pixel Flow.

## Progression & tutorial

- Level 1 runs a floating-hand pointer over the first inventory pig on first
  launch; the same pointer reappears on a waiting slot the first time a pig
  parks in one (seen-flags persist in `localStorage`).
- Completing a level records a star rating (3 / 2 / 1) based on inventory
  efficiency and unlocks the next entry on the title screen.
- Progress is stored under `pixel-flow-progress-v1`. Clear it via DevTools
  → Application → Local Storage to replay from scratch.

---

## Mobile testing tips

- **Chrome Android / Safari iOS** — open the dev server over your LAN:
  `npm run dev -- --host`, then visit `http://<your-ip>:5173` on the device.
  Add to home screen for a chromeless test.
- **Haptics** — only fires on devices supporting `navigator.vibrate`.
  Gracefully no-ops elsewhere.
- **Audio** — first tap resumes the `AudioContext` (browsers require a user
  gesture); all subsequent SFX play instantly.

---

## License

TBD.
