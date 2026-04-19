# Pixel Flow — Implementation Prompt

You are the engineering agent (or team) responsible for building **Pixel Flow** from scratch. This document is your execution contract. It is self-contained: read `GDD.md` for design intent and read this file for how to build it. If the two conflict on mechanics, `GDD.md` wins; if they conflict on stack/process, this file wins.

---

## 1. Mission

Deliver a playable, mobile-web-first v1 of Pixel Flow as described in `GDD.md`. "Playable v1" means: at least 5 hand-authored levels, all five GDD phases implemented, deployable as a static web build.

---

## 2. Hard Constraints

1. **Stack:** Phaser 3 (latest stable) + TypeScript (strict mode) + Vite.
2. **Orientation:** portrait-first (9:16 logical safe area). Must also run in landscape/desktop browsers without layout breakage (letterbox is fine).
3. **Input:** single-tap only. No drag, no hold, no multi-touch gestures.
4. **Art:** no paid/licensed art in v1. Use Phaser `Graphics` primitives and solid-color sprites; placeholder cubes are flat-color squares, pigs are rounded squares with a small ears/snout silhouette and a bold black number. Pixel-art PNGs for levels are required (authored simply, in any editor).
5. **Determinism:** game logic runs on a fixed-step tick decoupled from render. Systems consume/produce plain data so they are unit-testable without Phaser.
6. **No runtime dependencies** beyond Phaser 3 and its transitive deps. No analytics SDK, no ad SDK, no backend.
7. **Code quality:** TypeScript `strict: true`, ESLint + Prettier configured, all public functions typed, no `any` in domain code (test code may relax).

---

## 3. Repo Layout (target)

```
piggypig/
├── GDD.md
├── PROMPT.md
├── README.md                     # short: how to dev/build
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── public/
│   └── (static assets, favicon)
├── src/
│   ├── main.ts                   # Phaser bootstrap
│   ├── types.ts                  # shared domain types (Pig, Cube, Level, Color, ...)
│   ├── config.ts                 # tick rate, palette, tuning constants
│   ├── scenes/
│   │   ├── BootScene.ts          # asset + level manifest preload
│   │   ├── TitleScene.ts         # minimal level picker
│   │   ├── LevelScene.ts         # in-game board + belt
│   │   └── UIScene.ts            # HUD overlay (capacity, slots, inventory, X)
│   ├── systems/
│   │   ├── BeltSystem.ts         # pig position along polyline, capacity gate
│   │   ├── ShootingSystem.ts     # LOS raycast, hit resolution, ammo decrement
│   │   ├── InventorySystem.ts    # tap→deploy, chain/lock/hidden resolution
│   │   ├── WaitingSlotsSystem.ts # park, redeploy, slot occupancy
│   │   └── WinFailSystem.ts      # win/fail predicates
│   ├── entities/
│   │   ├── Pig.ts                # pig render adapter
│   │   └── Cube.ts               # cube render adapter
│   └── loaders/
│       ├── levelLoader.ts        # level JSON → world state
│       └── pngLevelLoader.ts     # PNG + palette → cube grid
├── levels/
│   ├── level-01.json
│   ├── level-01.png
│   ├── level-02.json
│   ├── level-02.png
│   ├── level-03.json
│   ├── level-03.png
│   ├── level-04.json
│   ├── level-04.png
│   ├── level-05.json
│   └── level-05.png
└── tests/
    ├── BeltSystem.test.ts
    ├── ShootingSystem.test.ts
    ├── InventorySystem.test.ts
    ├── WaitingSlotsSystem.test.ts
    └── WinFailSystem.test.ts
```

---

## 4. Phased Work Plan

Work through phases in order. Do not start phase N+1 until phase N's acceptance criteria pass. Ship an intermediate commit at the end of each phase.

### Phase 1 — Prototype Belt

**Goal:** render the board frame and belt path; a single dummy pig traverses the belt loop at constant speed.

**Tasks:**
- Scaffold Vite + Phaser 3 + TS project.
- Set up portrait canvas with `Phaser.Scale.FIT` and a 9:16 logical resolution (e.g. 720×1280).
- Implement `BeltSystem` reading a polyline `path` and `speed` from level JSON.
- Render the belt visually (line + directional chevrons) and one placeholder pig that traverses it.
- Hardcode a trivial level JSON for this phase.

**Accept:**
- Pig spawns at `path[0]`, moves through each waypoint at constant linear speed, loops, no crashes.
- Pig direction updates correctly at each waypoint (for later perpendicular raycasting).
- `npm run dev` opens a page where the pig is visibly looping.

### Phase 2 — Shoot & Ammo

**Goal:** pigs shoot matching-colored cubes perpendicular to travel; ammo decrements; pigs despawn at 0.

**Tasks:**
- Implement `Cube` storage (spatial grid keyed by `gridX, gridY`) and a minimal hand-authored cube layout.
- Implement `ShootingSystem`:
  - Every `shotCooldownMs` (default 120 ms), for each pig on the belt, cast a ray perpendicular to `pig.direction`.
  - Use grid stepping (not physics) to find the first cube along the ray.
  - If color matches: destroy cube, decrement `pig.ammo`, spawn projectile VFX.
  - If color does not match: no shot; the cube shields the ray.
- Despawn pig when `ammo` hits 0.
- Wire tap-to-deploy from a static inventory button row.

**Accept:**
- A preset level with one color (e.g. all-green cubes and one green pig with exact ammo) can be cleared by a single tap.
- A multi-color level can be cleared by tapping pigs in the author-intended order.
- Non-matching outer cubes correctly shield inner cubes.
- Unit tests cover `ShootingSystem.resolveHits` for: direct hit, color mismatch shield, empty ray.

### Phase 3 — Capacity + Waiting Slots

**Goal:** enforce belt capacity and implement the 5 waiting slots.

**Tasks:**
- Track `onBelt` count; block `InventorySystem.deploy` when `onBelt >= capacity`.
- Render capacity readout `onBelt / capacity` near belt entrance; flash red on blocked tap.
- `WaitingSlotsSystem`: when a pig completes the loop with `ammo > 0`, place it in the leftmost free slot.
- Tap on a waiting slot → redeploy that pig (subject to capacity).
- `WinFailSystem`: detect fail per the GDD §9 rules.

**Accept:**
- Deploy is visibly blocked when belt is full; UI gives negative feedback.
- A pig with leftover ammo parks in the leftmost free slot; subsequent parkers fill rightward.
- Tapping a slot pig redeploys it (if capacity allows).
- A deliberately unsolvable scenario triggers the fail state screen.
- Unit tests cover slot park order, redeploy, and fail predicate edge cases.

### Phase 4 — Level Modifiers

**Goal:** implement the three inventory modifiers: hidden `?`, chains, locks.

**Tasks:**
- **Hidden (`?`):** pig renders as `?` until it becomes the front-of-queue; then its color reveals with a quick flip animation.
- **Chains (`chainId`):** deploying any pig in a chain deploys all pigs sharing that chain id simultaneously, in order, respecting capacity (all-or-nothing).
- **Locks (`locked`):** parse simple condition strings (see below); render golden padlock; disable tap until condition is true. Re-evaluate after every cube destruction and every deploy.

**Condition string grammar (minimal, extensible):**
```
cubesOfColorCleared:<color>:<n>     # at least n cubes of given color destroyed
slotsFree:>=<n>                     # at least n waiting slots free
beltEmpty                           # no pigs currently on belt
cubesRemaining:<=<n>                # at most n cubes remain on board
```

**Accept:**
- A level JSON can declare all three modifier types and behave correctly end-to-end.
- Chain icons (connecting bar) render in inventory.
- Lock icon clears the moment its condition becomes true.
- Unit tests cover each condition type and chain all-or-nothing deploy semantics.

### Phase 5 — Polish

**Goal:** authoring pipeline, VFX, audio, scene flow.

**Tasks:**
- **PNG level loader (`pngLevelLoader.ts`):** at scene boot, draw the level PNG to an offscreen canvas, read pixel data, map each non-transparent hex in the level's `palette` to a cube at that `gridX, gridY`. Transparent pixels produce no cube.
- **VFX:** cube pop (particle burst in cube color), projectile trail, pig despawn puff, level-clear board sweep.
- **Audio:** load and play pew-pew shot, cube pop, level-clear fanfare, fail sting. Expose mute toggle in UI.
- **Haptics:** `navigator.vibrate(15)` on cube destruction (guarded by capability check).
- **Scene flow:** `TitleScene` (level list) → `LevelScene` + `UIScene` (parallel) → results overlay → next level / retry.
- **Authoring:** ship all 5 levels via PNG + JSON.

**Accept:**
- All 5 shipped levels are playable end-to-end from title → play → result.
- PNG edits propagate to gameplay with no code change.
- `vite build` produces a static `dist/` that runs on mobile Chrome and Safari in portrait without layout breakage.

---

## 5. Testing

### Unit tests (Vitest)
Pure systems only — no Phaser imports in tests.
- `BeltSystem.tick(state, dt)` — position progression, waypoint transitions, direction updates.
- `ShootingSystem.resolveHits(state)` — LOS raycast correctness, shielding, ammo decrement, despawn.
- `InventorySystem.deploy(state, pigId)` — capacity gate, chain all-or-nothing, lock rejection, hidden reveal.
- `WaitingSlotsSystem.park(state, pig)` and `.redeploy(state, slotIndex)`.
- `WinFailSystem.evaluate(state)` — all fail-state branches from GDD §9.

### Manual playtest checklist (each phase ends with this)
- [ ] Phone portrait (Chrome Android or iOS Safari) — layout intact, tap targets ≥ 44×44 CSS px.
- [ ] Desktop browser — canvas letterboxes cleanly.
- [ ] 60 Hz tick is stable; no GC hitches on cube destruction bursts.
- [ ] No console errors during a full level playthrough.

---

## 6. Definition of Done (v1)

1. All five phases' acceptance criteria pass.
2. 5 levels shipped in `/levels`, each with a PNG + JSON pair.
3. `npm run test` is green.
4. `npm run build` succeeds; the `dist/` output runs locally via `npm run preview` and on at least one mobile browser.
5. `README.md` documents: how to install, dev, test, build, author a new level.
6. No TODO / FIXME / `any` in shipped domain code.

---

## 7. What NOT to Do

- Do **not** add monetization code (ads, IAP).
- Do **not** add analytics or telemetry SDKs.
- Do **not** stand up any backend, auth, or account system.
- Do **not** build a multiplayer or real-time sync layer.
- Do **not** build an in-game level editor UI — authoring is PNG + JSON only.
- Do **not** introduce an ECS framework or custom engine abstraction; lean on Phaser's scenes, input, and tweens and keep systems as plain functions over plain state.
- Do **not** design for hypothetical future requirements. Ship v1 as scoped; new modifiers or meta systems are separate branches.

---

## 8. First Commit Checklist

When you start Phase 1, your first commit on `claude/<phase-1-branch>` should contain:
- `package.json`, `tsconfig.json`, `vite.config.ts`, `.eslintrc.cjs`, `.prettierrc`, `index.html`.
- Empty stub files at each path in the repo layout above, each with a one-line comment describing its responsibility.
- A minimal `README.md` with install/dev/build commands.

This makes subsequent diffs easy to review and keeps the layout stable from the start.

---

**End of prompt.** Read `GDD.md` next, then begin Phase 1.
