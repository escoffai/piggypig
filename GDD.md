# Pixel Flow — Game Design Document

**Working title:** Pixel Flow
**Doc status:** v1 design reference
**Primary build target:** mobile-web (portrait), desktop browser compatible
**Reference implementation:** Phaser 3 + TypeScript + Vite (see Appendix B)

---

## 1. Overview

Pixel Flow is a casual, one-tap puzzle game. A looping conveyor belt wraps a central pixel-art picture made of colored cubes. The player taps colored "pigs" from an inventory; each pig rides the belt and automatically shoots cubes of its matching color. A number above each pig is its ammo — when it hits zero, the pig leaves the stage. Pigs that survive a full loop park in one of five waiting slots for redeployment. Clear the picture to win.

- **Genre tags:** casual, puzzle, flow management, one-tap, color match.
- **Target audience:** hyper-casual and casual puzzle players looking for short, one-handed sessions with a "one more round" hook.
- **Session length:** 30–90 seconds per level.
- **Platforms:** mobile web first (portrait, 9:16 safe area); playable on desktop browsers; architected so a native mobile wrapper (Capacitor / Cordova / WebView shell) is a straightforward follow-up.

---

## 2. Core Loop

```
tap pig in inventory
        ↓
pig enters conveyor belt
        ↓
pig auto-shoots matching-colored cubes perpendicular to its travel
        ↓
ammo decrements on each hit
   ├─ ammo == 0  → pig despawns
   └─ pig completes loop with ammo > 0 → parks in a waiting slot
        ↓
player taps waiting-slot pig to redeploy
        ↓
repeat until board is cleared (win) or stuck (fail)
```

Short, punchy, sticky. Every tap produces immediate visible progress: shots fire, cubes pop, the image clarifies.

---

## 3. Visual & Audio Direction

### Visual
- **Perspective:** 2D top-down orthographic.
- **Backdrop:** minimalist dark navy / slate so the colorful board and pigs pop.
- **Board:** pixel-art picture composed of 1×1 cubes on a uniform grid. Outer cubes visually frame an inner image (e.g. cactus, smoothie, princess, butterfly).
- **Pigs:** cute rounded-square bodies with tiny ears and snout. Solid base color. A bold black numeral centered on the body shows remaining ammo.
- **Belt:** light grey/chrome track with directional chevrons (`<`, `>`) repeating along its length to reinforce flow direction.
- **Waiting slots:** 5 dark rounded rectangles directly below the belt entrance.
- **Inventory:** grid of upcoming pigs below the waiting slots; may scroll vertically.

### Palette (pilot pig/cube colors)
`red`, `blue`, `green`, `yellow`, `pink`, `purple`, `orange`, `white`, `black`. Extensible.

### Audio
- **SFX:** rapid, light "pew-pew" for shots; crisp pop/shatter for cube destruction; soft click on tap; short fanfare on level clear; soft fail sting on loss.
- **Music:** low-key loop per scene (title, gameplay, results); mutable from UI.
- **Haptics:** short `navigator.vibrate(15)` pulse on cube destruction (mobile web only).

---

## 4. Entities

### 4.1 Pig
```ts
type Pig = {
  id: string;
  color: Color;           // one of the palette colors; may be hidden by "?"
  ammo: number;           // hits remaining; 0 → despawn
  chainId?: string;       // if set, deployed together with other pigs sharing this id
  locked?: LockCondition; // if set, cannot be tapped until condition is satisfied
  hidden?: boolean;       // "?" pigs; color revealed when fronted in inventory
};
```

### 4.2 Pixel Cube
```ts
type Cube = {
  color: Color;
  gridX: number;
  gridY: number;
  hp: 1;  // v1: all cubes are 1-hit; reserved for future variants
};
```

### 4.3 Conveyor Belt
- A directed path around the board, expressed as an ordered polyline of waypoints.
- May be U-shaped, rectangular, or fully enclosed.
- Has a **capacity** (`capacity: number`) — the max number of pigs simultaneously on the belt. Shown as `onBelt / capacity` near the entrance (e.g. `4/8`, `1/14`).
- Pigs move at a constant linear speed along the polyline; speed is configurable per level.

### 4.4 Waiting Slots
- Exactly **5** slots, positioned directly below the belt exit / entrance area.
- A pig that completes a full loop with `ammo > 0` parks in the leftmost free slot.
- Each slot is individually tappable to redeploy that specific pig.
- If all 5 slots are full and no legal tap (inventory or slots) can make progress → fail.

### 4.5 Main Inventory
- A scrollable grid of upcoming pigs below the waiting slots.
- Entries are consumed in order when tapped (front-of-queue semantics for chained / hidden logic).
- Inventory entries may carry modifiers: `hidden` (`?`), `chainId`, or `locked`.

---

## 5. Mechanics Spec

### 5.1 Color Match & Line-of-Sight Shooting
- On each game tick, every pig on the belt performs a **perpendicular raycast** relative to its current travel direction (both sides if the belt has cubes on both sides, otherwise the inboard side).
- The first cube hit along that ray is evaluated:
  - If `cube.color == pig.color` → fire projectile, destroy cube on impact, `pig.ammo -= 1`.
  - Otherwise → no shot (the non-matching cube shields anything behind it).
- A pig fires at most once per `shotCooldownMs` (e.g. 120 ms) to produce a readable "pew-pew" cadence instead of an instant laser.
- Outer cubes act as a wall for the LOS raycast. This means players must clear outer layers first to expose inner ones — a core strategic constraint.

### 5.2 Ammo
- `pig.ammo` decrements by 1 per successful hit.
- When `pig.ammo` reaches 0, play the pop/despawn VFX and remove the pig from the simulation immediately, regardless of belt position.

### 5.3 Belt Capacity
- Deploying a pig is blocked when `onBelt >= capacity`. Tap is absorbed with a subtle negative feedback (shake + dim).
- Chained deploys count against capacity per-pig; if the remaining capacity cannot fit the whole chain, none of the chain deploys.

### 5.4 Waiting Slots
- Pigs that complete the loop with `ammo > 0` exit the belt into the leftmost free slot.
- Slot → belt redeployment obeys the same capacity rule.
- If all 5 slots are full and (inventory empty OR next inventory pig is locked behind a condition the board cannot yet satisfy) and no slot pig can be deployed because the belt is full and no belt pig can make progress — the game enters **fail state**.

### 5.5 Inventory Modifiers
- **Hidden (`?`):** pig color is unknown until this pig becomes the front-of-queue (i.e. all pigs in front of it have been consumed). At that moment its color is revealed and it becomes tappable like any normal pig.
- **Chain:** pigs sharing a `chainId` deploy together as a single tap. Visually indicated by a connecting bar between them in the inventory.
- **Lock:** pig is displayed with a golden padlock and is untappable until `locked` condition resolves to true. Example conditions: `"cubesOfColorCleared:green:10"`, `"slotsFree:>=3"`, `"beltEmpty"`.

---

## 6. Level Design

### 6.1 Authoring Pipeline
- **Image-first authoring.** Each level's picture is authored as a PNG. At load time, a loader maps each non-transparent pixel to a cube of the matching palette color. Transparent / background pixels produce no cube.
- This allows artists to iterate on pictures in any pixel-art editor without touching game code.

### 6.2 Level JSON
Each level is described by a JSON file alongside its PNG:

```json
{
  "id": "level-01",
  "image": "levels/level-01.png",
  "palette": {
    "#E74C3C": "red",
    "#3498DB": "blue",
    "#2ECC71": "green",
    "#F1C40F": "yellow",
    "#E91E63": "pink",
    "#9B59B6": "purple",
    "#E67E22": "orange",
    "#FFFFFF": "white",
    "#111111": "black"
  },
  "belt": {
    "capacity": 5,
    "speed": 120,
    "path": [
      { "x": 80,  "y": 900 },
      { "x": 80,  "y": 200 },
      { "x": 640, "y": 200 },
      { "x": 640, "y": 900 },
      { "x": 80,  "y": 900 }
    ]
  },
  "inventory": [
    { "color": "green",  "ammo": 20 },
    { "color": "yellow", "ammo": 30 },
    { "color": "white",  "ammo": 30, "chainId": "c1" },
    { "color": "white",  "ammo": 30, "chainId": "c1" },
    { "hidden": true,    "ammo": 20 },
    { "color": "pink",   "ammo": 20, "locked": "cubesOfColorCleared:green:10" }
  ],
  "win": { "type": "clearAllCubes" }
}
```

### 6.3 Difficulty Curve
- Early levels: open belt with one or two colors, generous ammo, no modifiers.
- Mid levels: tight belt capacity, introduce `?` pigs, start layering outer/inner cubes.
- Late levels: chains + locks, minimal ammo slack, multi-color inner cores requiring outer-layer clearance first.

---

## 7. UI / UX

### 7.1 Layout (portrait 9:16)
```
┌──────────────────────────┐
│ [X]                 [⚙]  │  ← close / settings
│                          │
│    ┌──────────────┐      │
│    │              │      │
│    │   PIXEL ART  │      │  ← board (cubes)
│    │    BOARD     │      │
│    │              │      │
│    └──────────────┘      │
│      (conveyor belt loops around board)
│   [onBelt]/[capacity]    │  ← capacity readout
│ ┌──┬──┬──┬──┬──┐         │
│ │  │  │  │  │  │         │  ← 5 waiting slots
│ └──┴──┴──┴──┴──┘         │
│ ┌──┬──┬──┬──┬──┐         │
│ │🐷│🐷│🐷│🐷│🐷│         │  ← inventory row(s), scrollable
│ └──┴──┴──┴──┴──┘         │
└──────────────────────────┘
```

### 7.2 Controls
- **Single tap only.** Tap inventory pig → deploy. Tap waiting-slot pig → redeploy. Tap X → confirm quit.
- No drag, no hold, no multi-touch.

### 7.3 Feedback
- Capacity-blocked tap: subtle shake + red dim on the capacity readout.
- Hit: projectile line from pig to cube, cube pop particles, haptic pulse, ammo numeral flashes.
- Pig despawn (ammo 0): small burst, number `0` lingers briefly then fades.
- Level clear: board-wide confetti sweep + results panel (stars, next-level CTA).

### 7.4 Tutorial
- Level 1 displays a hand-pointer guiding the first tap, then a second pointer on a waiting slot once a pig parks.
- No textual tutorials — learn by doing.

---

## 8. Progression & Meta (v1 scope-light)

- Sequential level list; next level unlocks on completion.
- Star rating per level based on efficiency (e.g. pigs used vs. par).
- Soft-currency stub reserved for future (coin on level clear) — **not** wired to any shop in v1.
- No ads, no IAP, no accounts in v1.

Flagged as **post-v1**: leaderboards, daily challenge, cosmetic skins, shop.

---

## 9. Win / Fail States

### Win
- `cubesRemaining == 0` — the picture is fully cleared.

### Fail
A level fails when **all** of the following are true:
1. `cubesRemaining > 0`.
2. `onBelt == 0` AND `waitingSlots.every(slot => slot.empty)` AND `inventory` contains no tappable (non-locked, non-blocked-by-capacity) pig,
   OR
   all 5 waiting slots are full AND no slot pig can be redeployed because the belt is at capacity AND no belt pig will make further progress (no matching cubes in LOS anywhere on the remaining loop).

The fail detector runs after each entity state change, not every tick, to keep the check cheap.

---

## 10. Out of Scope (v1)

- Multiplayer / co-op.
- Ad network integration.
- In-app purchases and real-money monetization.
- Account sync / cloud saves.
- In-game level editor UI (authoring happens via PNG + JSON externally).
- Native push notifications.

---

## 11. Appendix A — Pilot Level Sample

**Picture:** a tiny 6×6 cactus with a yellow hat.

Legend: `.` = empty, `G` = green, `Y` = yellow, `P` = pink (flower).

```
. Y Y Y Y .
. Y Y Y Y .
. G G G G .
P G G G G P
. G G G G .
. G G G G .
```

**Level JSON (`levels/level-01.json`):**

```json
{
  "id": "level-01",
  "image": "levels/level-01.png",
  "palette": {
    "#2ECC71": "green",
    "#F1C40F": "yellow",
    "#E91E63": "pink"
  },
  "belt": {
    "capacity": 3,
    "speed": 120,
    "path": [
      { "x": 60,  "y": 800 },
      { "x": 60,  "y": 240 },
      { "x": 540, "y": 240 },
      { "x": 540, "y": 800 },
      { "x": 60,  "y": 800 }
    ]
  },
  "inventory": [
    { "color": "yellow", "ammo": 8 },
    { "color": "green",  "ammo": 16 },
    { "color": "pink",   "ammo": 2 }
  ],
  "win": { "type": "clearAllCubes" }
}
```

This level is explicitly solvable: 8 yellow cubes, 16 green, 2 pink — ammo totals are tuned with zero slack so the player cannot waste a pig.

---

## 12. Appendix B — Reference Implementation Notes

- **Stack:** Phaser 3 (latest stable) + TypeScript + Vite.
- **Rendering:** Phaser's WebGL renderer; portrait canvas scaled with `Phaser.Scale.FIT` to keep 9:16.
- **Structure:** scenes for `Boot`, `Level`, `UI` (UI runs parallel to Level for HUD overlay). Game logic lives in lightweight "systems" (Belt, Shooting, Inventory, WaitingSlots, WinFail) that operate on plain data, decoupled from Phaser rendering for unit-testability.
- **Tick:** fixed-step logical tick (e.g. 60 Hz) independent of render framerate; deterministic and testable.
- **PNG level loader:** uses an offscreen canvas to read pixel data and map palette hex → cube color.
- **Testing:** Vitest for pure systems; manual playtest checklist for scene-level behavior.
- **Packaging:** `vite build` emits static assets deployable to any CDN; mobile-native wrapping (Capacitor) is deferred.

See `PROMPT.md` for the full engineering brief.
