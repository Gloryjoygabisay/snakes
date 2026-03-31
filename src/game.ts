import Phaser from 'phaser';

export interface GameController { destroy(): void; }

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;

interface Challenge {
  q: string;
  choices: string[];
  answer: number;
}

const CHALLENGES: Challenge[] = [
  { q: 'What is 7 × 8?', choices: ['54', '56', '64', '48'], answer: 1 },
  { q: 'Which planet is closest to the Sun?', choices: ['Venus', 'Mars', 'Mercury', 'Earth'], answer: 2 },
  { q: 'What is the capital of France?', choices: ['Berlin', 'Paris', 'Rome', 'Madrid'], answer: 1 },
  { q: 'How many sides does a hexagon have?', choices: ['5', '7', '6', '8'], answer: 2 },
  { q: 'What is 15% of 200?', choices: ['25', '35', '30', '40'], answer: 2 },
  { q: 'Which gas do plants absorb?', choices: ['Oxygen', 'Nitrogen', 'CO₂', 'Hydrogen'], answer: 2 },
  { q: 'What is √144?', choices: ['11', '12', '13', '14'], answer: 1 },
  { q: 'How many days in a leap year?', choices: ['364', '365', '366', '367'], answer: 2 },
  { q: 'What color is a ruby?', choices: ['Blue', 'Green', 'Red', 'Yellow'], answer: 2 },
  { q: 'Which is the largest ocean?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  // Riddles — used by the Level 1 escape gate (indices 10-14)
  { q: 'I move without legs.\nI strike without teeth.\nWhat am I?', choices: ['Wind', 'Shadow', 'Venom', 'Water'], answer: 2 },
  { q: 'The more you take,\nthe more you leave behind.\nWhat am I?', choices: ['Memory', 'Footsteps', 'Echoes', 'Time'], answer: 1 },
  { q: 'I have no voice, yet I speak.\nI have no eyes, yet I warn.\nWhat am I?', choices: ['A shadow', 'A sign', 'A snake', 'A storm'], answer: 1 },
  { q: 'I can swallow you whole\nbut have no mouth.\nWhat am I?', choices: ['Fear', 'A cave', 'Silence', 'Darkness'], answer: 1 },
  { q: 'Alive without breath,\ncold as death.\nSlithering yet not a snake.\nWhat am I?', choices: ['A river', 'A ghost', 'Ice', 'Mist'], answer: 0 },
  // Fruit House puzzles — unlock the exit door in Level 1 (indices 15–17)
  { q: '🍎 🍌 🍓 🍎 🍌 ?\n(What fruit comes next in the pattern?)', choices: ['🍎 Apple', '🍓 Berry', '🍌 Banana'], answer: 1 },
  { q: 'Which fruit makes Glory\ninvisible to snakes?', choices: ['🍌 Banana', '🍓 Berry', '🍎 Apple'], answer: 1 },
  { q: 'Which fruit restores\nGlory\'s health?', choices: ['🍌 Banana', '🍓 Berry', '🍎 Apple'], answer: 2 },
  // Level 3 bamboo bridge gate riddle (index 18)
  { q: 'I creak beneath your feet,\nstretch across the void,\nand hold you above nothing.\nWhat am I?', choices: ['A rope', 'A bridge', 'A plank', 'A shadow'], answer: 1 },
];

function hwall(row: number, c1: number, c2: number): [number, number][] {
  const r: [number, number][] = [];
  for (let c = c1; c <= c2; c++) r.push([c, row]);
  return r;
}
function vwall(col: number, r1: number, r2: number): [number, number][] {
  const r: [number, number][] = [];
  for (let row = r1; row <= r2; row++) r.push([col, row]);
  return r;
}

interface IQGateConfig { col: number; row: number; challengeIdx: number; }
interface MovingWallConfig { col: number; row: number; col2: number; row2: number; intervalMs: number; }

type SnakeBehavior = 'chaser' | 'random' | 'guard' | 'slow' | 'patrol' | 'hunter' | 'sleeper' | 'sentry';
interface SnakeEnemyConfig {
  behavior: SnakeBehavior;
  tickMs: number;     // ms per move step
  startCol: number;
  startRow: number;
  color?: number;     // optional override; falls back to SNAKE_COLORS
  // patrol waypoints (only used when behavior === 'patrol')
  patrolA?: { col: number; row: number };
  patrolB?: { col: number; row: number };
}

interface LevelConfig {
  name: string;
  survivalGoal: number;
  snakeCount: number;
  snakeTickMs: number;
  glorySpeed: number;
  lives: number;
  scoreMultiplier: number;
  fogOfWar: boolean;
  walls: [number, number][];
  poisonTiles: [number, number][];
  iqGatePositions: IQGateConfig[];
  movingWallConfigs: MovingWallConfig[];
  hasBoss: boolean;
  speedRamp: boolean;
  // Optional: exit-based win instead of survival timer
  exitZone?: { col: number; row: number };
  collectibles?: [number, number, FruitKind?][];
  gloryStart?: { col: number; row: number };
  bushes?: [number, number][];
  bannerText?: string;      // shown as popup text when level starts (e.g. Level 3)
  windEffect?: boolean;     // Level 9: wind pushes snake slightly
  reversedControls?: boolean; // Mirror Maze: joystick direction is inverted
  isBonus?: boolean;          // marks as bonus level
  snakeEnemyConfigs?: SnakeEnemyConfig[];  // per-snake behavior overrides (replaces snakeCount when set)
  houseLayout?: boolean;      // renders as an indoor house with interior background (no start gate)
}

const LEVEL_CONFIGS: LevelConfig[] = [
  // Level 1: Fruit House Trap — Glory enters a house full of fruits... and snakes
  //
  //  Layout (cols 3–28, rows 2–21)
  //  ┌──────────────────────────────────────────────────────┐
  //  │  [NW ROOM]   col12│hallway│col15   [NE ROOM]         │
  //  │  cols 4–11   ─────┤13–14  ├─────   cols 16–27        │
  //  │  ┌─pocket─┐  row5↕│       │↕row5   ┌────pocket───┐   │
  //  │  │rows 3–4│  ─────┤       ├─────   │ rows 3–4    │   │
  //  │  │(berry) │       │       │        │cols 21–27   │   │
  //  │  └──row5──┘       │       │        │  (berry)    │   │
  //  │   (wall 4–7)      │       │        └──row5──(21–27)  │
  //  │  rows 6–7  ───────┴───────┴────────   rows 6–7       │
  //  ├──row8──[gap8–9]──────────────────[gap22–23]──row8────┤
  //  ░  ←entry     MAIN CORRIDOR (rows 9–11)      exit→  ░
  //  ├──row12─[gap8–9]──────────────────[gap22–23]──row12───┤
  //  │  [SW ROOM]        center hallway            [SE ROOM] │
  //  │  rows 13–17  ─────┤13–14  ├─────   rows 13–17        │
  //  │                row15↕│       │↕row15                  │
  //  │  rows 18–20  ─────┤       ├─────   rows 18–20        │
  //  │  ┌─pocket──┐ (wall 4–7)    (wall 22–27)  ┌──pocket─┐ │
  //  │  │rows19–20│                              │rows19–20│ │
  //  │  │ (apple) │                              │(banana) │ │
  //  └──────────────────────────────────────────────────────┘
  {
    name: 'Fruit House Trap',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 600, glorySpeed: 1.8, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    houseLayout: true,
    bannerText: '🏠 FRUIT HOUSE TRAP\nEat wisely. Escape alive.',
    walls: [
      // ── OUTER PERIMETER ──────────────────────────────────────────────────────
      ...hwall(2,  3, 28),                              // top wall
      ...hwall(21, 3, 28),                              // bottom wall
      ...vwall(3,  2,  8), ...vwall(3,  12, 21),        // left wall  (entry gap rows 9–11)
      ...vwall(28, 2,  8), ...vwall(28, 12, 21),        // right wall (exit gap rows 9–11)

      // ── UPPER/LOWER ZONE SEPARATORS (rows 8 & 12) ───────────────────────────
      // gaps: cols 8–9 (NW/SW doorway), cols 13–14 (center hallway pass-through), cols 22–23 (NE/SE doorway)
      ...hwall(8,  4,  7), ...hwall(8,  10, 11), ...hwall(8,  16, 21), ...hwall(8,  24, 27),
      ...hwall(12, 4,  7), ...hwall(12, 10, 11), ...hwall(12, 16, 21), ...hwall(12, 24, 27),

      // ── CENTER VERTICAL HALLWAY WALLS (cols 12 & 15) ─────────────────────────
      // Narrow 2-cell hallway (cols 13–14) connecting top & bottom zones
      // Left wall (col 12): gap at rows 5–6 (NW↔hallway) and rows 15–16 (SW↔hallway)
      ...vwall(12, 3, 4), ...vwall(12, 7, 8), ...vwall(12, 13, 14), ...vwall(12, 17, 20),
      // Right wall (col 15): gap at rows 5–6 (hallway↔NE) and rows 15–16 (hallway↔SE)
      ...vwall(15, 3, 4), ...vwall(15, 7, 8), ...vwall(15, 13, 14), ...vwall(15, 17, 20),

      // ── DEAD-END ALCOVES (hidden pockets for risky fruit grabs) ──────────────
      // NW pocket (rows 3–4, cols 4–11): entry via cols 8–11 at row 5 only
      ...hwall(5, 4, 7),
      // NE pocket (rows 3–4, cols 21–27): entry via cols 16–20 at row 5, then right
      ...hwall(5, 21, 27),
      // SW pocket (rows 19–20, cols 4–11): entry via cols 8–11 at row 18, then left
      ...hwall(18, 4, 7),
      // SE pocket (rows 19–20, cols 22–27): entry via col 21 at row 18, then right
      ...hwall(18, 22, 27),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 10 },
    exitZone:   { col: 29, row: 10 },
    // 🍎 Apple → +health · 🍌 Banana → speed boost · 🍓 Berry → invisibility
    collectibles: [
      [5,  3,  'berry'],   // NW pocket  — berry tucked in dead-end (sleeper snake nearby!)
      [9,  6,  'banana'],  // NW room    — banana for speed dashes
      [8,  10, 'apple'],   // corridor L — health pickup in open ground
      [13, 6,  'banana'],  // center hallway — banana (sentry blocks this route!)
      [22, 10, 'apple'],   // corridor R — health pickup
      [25, 4,  'berry'],   // NE pocket  — invisibility berry behind sentry!
      [18, 6,  'banana'],  // NE room    — banana
      [7,  16, 'apple'],   // SW room    — apple
      [5,  19, 'apple'],   // SW pocket  — apple in dead-end (sleeper nearby)
      [18, 15, 'berry'],   // SE room    — berry near hallway junction
      [24, 19, 'banana'],  // SE pocket  — banana (sleeper coiled here!)
    ] as [number, number, FruitKind][],
    bushes: [[9, 10], [20, 10]],  // two hiding spots along the main corridor
    snakeEnemyConfigs: [
      // 🟢 Sleeper — NW pocket, coiled by the berry; wakes when Glory reaches dead-end
      { behavior: 'sleeper', tickMs: 560, startCol: 6,  startRow: 3,  color: 0x7CFF4F },
      // 🟢 Sleeper — SE pocket, coiled by the banana; blocks exit from corner
      { behavior: 'sleeper', tickMs: 540, startCol: 23, startRow: 19, color: 0x4db82e },
      // 🟡 Patrol — NW room lower area, back-and-forth horizontal sweep
      { behavior: 'patrol', tickMs: 580, startCol: 7,  startRow: 6,  color: 0xffcc00,
        patrolA: { col: 4, row: 6 }, patrolB: { col: 11, row: 6 } },
      // 🟡 Patrol — NE room, roams between open area and pocket approach (unpredictable!)
      { behavior: 'patrol', tickMs: 560, startCol: 18, startRow: 6,  color: 0xff8800,
        patrolA: { col: 16, row: 3 }, patrolB: { col: 20, row: 7 } },
      // 🔴 Sentry — center hallway (only 2 cells wide!), charges anyone trying to shortcut
      { behavior: 'sentry', tickMs: 250, startCol: 14, startRow: 6,  color: 0xff2244 },
      // 🔴 Sentry — NE pocket entrance, guards the invisibility berry at [25,4]
      { behavior: 'sentry', tickMs: 240, startCol: 24, startRow: 4,  color: 0xFF5AAE },
    ],
  },
  // Level 2: Narrow Trail Escape — S-curve mountain trail; hunters chasing from behind!
  // Layout: upper-left corridor → connector 1 (down) → middle corridor → connector 2 (up) → upper-right corridor → exit
  {
    name: 'Narrow Trail Escape',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.0, lives: 3,
    scoreMultiplier: 1.2, fogOfWar: false, speedRamp: true,
    bannerText: '🌄 NARROW TRAIL\nThey followed you — RUN! 🏃‍♀️',
    walls: [
      // ── Upper-left trail: rows 5–6, cols 1–15 ───────────────────────────
      ...hwall(4,  1, 15),   // top wall
      ...hwall(7,  1, 11),   // bottom wall (gap at cols 12–15 for connector 1)
      // ── Connector 1: cols 12–15, rows 7–14 (going DOWN) ─────────────────
      ...vwall(11, 7, 14),   // left wall
      ...vwall(16, 4, 14),   // right wall (continuous from top of upper-left trail)
      // ── Middle trail: rows 15–16, cols 12–21 ─────────────────────────────
      ...hwall(14, 16, 21),  // top wall (cols 12–15 left open = connector 1 entry)
      ...hwall(17, 12, 22),  // bottom wall (col 22 closed; connector 2 entry at cols 20–22 above)
      // ── Connector 2: cols 20–22, rows 6–16 (going UP) ───────────────────
      ...vwall(19,  6, 14),  // left wall (stops above middle trail so rows 15-16 stay open)
      ...vwall(23,  7, 17),  // right wall (starts at row 7 — doesn't block upper-right corridor rows 5-6)
      // ── Upper-right trail: rows 5–6, cols 22–30 ─────────────────────────
      ...hwall(4, 20, 30),   // top wall (also seals top of connector 2 entry)
      ...hwall(7, 22, 30),   // bottom wall
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false,
    gloryStart: { col: 1,  row: 5 },
    exitZone:   { col: 30, row: 5 },
    collectibles: [
      // Upper-left trail — mixed fruits lure player forward
      [3,  5, 'apple'],   [6,  6, 'banana'],  [9,  5, 'apple'],
      // Connector 1 — risky mid-bend prizes
      [13, 9, 'banana'],  [13, 13, 'berry'],
      // Middle trail — rewards for surviving the choke
      [15, 15, 'apple'],  [18, 16, 'banana'],
      // Connector 2 + upper-right trail — final sprint prizes
      [21, 10, 'berry'],  [25, 5, 'banana'],  [28, 6, 'apple'],
    ] as [number, number, FruitKind][],
    bushes: [
      [4,  6],  // upper-left trail (early cover)
      [8,  5],  // upper-left trail (mid cover)
      [14, 14], // connector 1 / middle-trail junction
      [20, 15], // middle trail (only hope near choke)
      [24, 5],  // upper-right trail (pre-exit cover)
    ],
    snakeEnemyConfigs: [
      // 🔴 Fast Hunter — spawns behind Glory, chases hard from the left
      { behavior: 'hunter' as const, tickMs: 380, startCol: 0, startRow: 5, color: 0xff2244 },
      // 🟢 Hunter — second pursuer, slightly offset row so they don't stack
      { behavior: 'hunter' as const, tickMs: 430, startCol: 0, startRow: 6, color: 0x7CFF4F },
      // 🟡 Patrol — guards the middle choke; back-and-forth sweep
      { behavior: 'patrol' as const, tickMs: 460, startCol: 16, startRow: 15, color: 0xffcc00,
        patrolA: { col: 13, row: 15 }, patrolB: { col: 20, row: 15 } },
      // 🟠 Sentry — lurks near the exit; charges when Glory enters the final stretch
      { behavior: 'sentry' as const, tickMs: 340, startCol: 26, startRow: 5, color: 0xff8800 },
    ],
  },
  // Level 3: Bamboo Bridge Maze — S-shaped bamboo bridge network over a dark abyss
  // Correct path: Bridge1 → Connector1 DOWN → Bridge2 → Connector2 DOWN → Bridge3 → exit
  // Dead ends: Bridge1 right stub, Bridge2 left, dead-end branch UP → Bridge4 (top-right)
  {
    name: 'Bamboo Bridge Maze',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 500, glorySpeed: 1.6, lives: 3,
    scoreMultiplier: 1.2, fogOfWar: true, speedRamp: false,
    bannerText: '🎋 BAMBOO BRIDGE MAZE\nIt creaks… and watches… 👁️',
    walls: [
      // Bridge 1 (start): rows 4-5, cols 1-20
      ...hwall(3, 1, 20), ...hwall(6, 1, 10), ...hwall(6, 13, 20), ...vwall(20, 3, 6),
      // Connector 1 (DOWN): cols 11-12, rows 6-12
      ...vwall(10, 6, 12), ...vwall(13, 6, 12),
      // Bridge 2 (middle): rows 13-14, cols 7-23
      ...hwall(12, 7, 10), ...hwall(12, 13, 19), ...hwall(12, 22, 23),
      ...hwall(15, 7, 13), ...hwall(15, 16, 23),
      ...vwall(7, 12, 15), ...vwall(23, 12, 15),
      // Dead-end branch (UP from Bridge 2): cols 20-21, rows 6-12
      ...vwall(19, 6, 12), ...vwall(22, 6, 12),
      // Bridge 4 (top-right dead end): rows 4-5, cols 18-30
      ...hwall(3, 18, 30), ...hwall(6, 18, 19), ...hwall(6, 22, 30), ...vwall(30, 3, 6),
      // Connector 2 (DOWN): cols 14-15, rows 15-18
      ...vwall(13, 15, 18), ...vwall(16, 15, 18),
      // Bridge 3 (exit): rows 19-20, cols 12-30
      ...hwall(18, 12, 13), ...hwall(18, 16, 30), ...hwall(21, 12, 30), ...vwall(12, 18, 21),
    ],
    poisonTiles: [],
    iqGatePositions: [
      { col: 15, row: 14, challengeIdx: 18 }, // guards correct Connector2 entry
    ],
    movingWallConfigs: [], hasBoss: false,
    gloryStart: { col: 1, row: 4 },
    exitZone:   { col: 30, row: 19 },
    collectibles: [
      // Bridge 1 — fruit trail hints the correct direction
      [3, 4, 'apple'], [6, 5, 'apple'], [9, 4, 'banana'],
      [16, 4, 'apple'],                       // dead-end fruit (tempting but wrong)
      // Connector 1 — reward for finding the path
      [11, 9, 'berry'],
      // Bridge 2
      [8, 13, 'apple'],                       // left dead end lure
      [17, 14, 'banana'],                     // near correct Connector2
      // Dead-end branch up
      [20, 9, 'berry'],                       // lures player into dead end
      // Bridge 4 dead end
      [25, 4, 'apple'], [27, 5, 'banana'],
      // Connector 2
      [14, 16, 'apple'],
      // Bridge 3 exit run
      [18, 19, 'banana'], [23, 20, 'apple'], [27, 19, 'berry'],
    ] as [number, number, FruitKind][],
    bushes: [],
    snakeEnemyConfigs: [
      // Ambush sleepers — coiled in dead ends; wake when player enters
      { behavior: 'sleeper' as const, tickMs: 500, startCol: 17, startRow: 4,  color: 0x7CFF4F }, // Bridge1 dead end
      { behavior: 'sleeper' as const, tickMs: 480, startCol: 26, startRow: 5,  color: 0x4db82e }, // Bridge4 dead end
      // Patrol guard — patrols Bridge2, blocks or forces detour
      { behavior: 'patrol' as const, tickMs: 520, startCol: 13, startRow: 13, color: 0xffcc00,
        patrolA: { col: 8, row: 13 }, patrolB: { col: 21, row: 14 } },
      // Ambush — coiled in Bridge3 exit stretch
      { behavior: 'sleeper' as const, tickMs: 460, startCol: 20, startRow: 19, color: 0xff2244 },
    ],
  },
  // Level 4: Split Paths — two parallel routes, dead ends, choice
  {
    name: 'Split Paths',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 460, glorySpeed: 2.0, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    walls: [
      // Upper path walls
      ...hwall(3,  3, 29), ...hwall(8,  3, 13), ...hwall(8, 17, 29),
      // Lower path walls
      ...hwall(21, 3, 29), ...hwall(16, 3, 13), ...hwall(16, 17, 29),
      // Middle divider (partial)
      ...vwall(13, 8, 16), ...vwall(17, 8, 16),
      // Dead ends
      ...vwall(8, 3, 7), ...vwall(8, 17, 21),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,6],[7,6],[10,6],[4,18],[7,18],[10,18],[18,6],[22,6],[26,6],[18,18],[22,18],[26,18],[28,12]] as [number,number][],
  },
  // Level 5: First Enemy — medium path, 1 slow enemy
  {
    name: 'First Enemy',
    survivalGoal: 999, snakeCount: 1, snakeTickMs: 420, glorySpeed: 2.0, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    walls: [
      ...hwall(8,  3, 29), ...hwall(16, 3, 29),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,12],[7,11],[10,13],[13,11],[16,13],[19,11],[22,13],[25,11],[27,12]] as [number,number][],
    bushes: [[5,13],[12,11],[20,13],[26,11]],
  },
  // Level 6: Dark Forest — fog of war, 1 enemy
  {
    name: 'Dark Forest',
    survivalGoal: 999, snakeCount: 1, snakeTickMs: 320, glorySpeed: 2.2, lives: 2, scoreMultiplier: 2, fogOfWar: true,
    walls: [
      ...vwall(6,  4,  8), ...vwall(6,  16, 20),
      ...vwall(12, 8, 12), ...vwall(12, 14, 18),
      ...vwall(18, 4,  8), ...vwall(18, 16, 20),
      ...vwall(24, 8, 12), ...vwall(24, 14, 18),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[3,12],[6,9],[9,12],[12,11],[16,12],[19,11],[22,12],[25,9],[28,12]] as [number,number][],
    bushes: [[4,14],[9,10],[15,14],[22,10]],
  },
  // Level 7: Cliff Edge Chaos — narrow S-curve, 2 enemies, faster
  {
    name: 'Cliff Edge Chaos',
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 240, glorySpeed: 2.5, lives: 2, scoreMultiplier: 2, fogOfWar: false,
    walls: [
      ...hwall(6,  3, 16), ...hwall(18, 14, 29),
      ...hwall(18, 3, 14), ...hwall(6, 14, 29),
      ...vwall(16, 6, 18), ...vwall(3,  6, 18),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 18 },
    exitZone:   { col: 30, row: 6 },
    collectibles: [[3,18],[6,15],[9,12],[12,9],[15,8],[18,10],[21,8],[24,6],[27,6]] as [number,number][],
  },
  // Level 8: Maze Survival — full maze, 2 enemies, food as bait
  {
    name: 'Maze Survival',
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 220, glorySpeed: 2.5, lives: 2, scoreMultiplier: 2, fogOfWar: false,
    walls: [
      ...hwall(3,  2, 16), ...hwall(3,  18, 30),
      ...hwall(9,  4, 12), ...hwall(9,  14, 22),
      ...hwall(15, 6, 14), ...hwall(15, 16, 24),
      ...hwall(21, 2, 10), ...hwall(21, 12, 20),
      ...vwall(6,  3,  9), ...vwall(6,  15, 21),
      ...vwall(12, 9, 15),
      ...vwall(18, 3,  9), ...vwall(18, 15, 21),
      ...vwall(24, 9, 15), ...vwall(28, 3, 21),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 1 },
    exitZone:   { col: 30, row: 22 },
    collectibles: [[2,5],[5,12],[8,18],[11,5],[14,12],[17,18],[20,5],[23,12],[26,18],[29,12]] as [number,number][],
  },
  // Level 9: Storm Mountain — wind effect, random obstacles, 3 fast enemies
  {
    name: 'Storm Mountain',
    survivalGoal: 999, snakeCount: 3, snakeTickMs: 200, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
    windEffect: true,
    walls: [
      ...hwall(7,  3, 10), ...hwall(7,  14, 18), ...hwall(7, 22, 29),
      ...hwall(12, 6, 12), ...hwall(12, 16, 22),
      ...hwall(17, 3,  8), ...hwall(17, 12, 18), ...hwall(17, 22, 29),
      ...vwall(3,  7, 17),
      ...vwall(10, 3,  7), ...vwall(10, 17, 22),
      ...vwall(18, 7, 12), ...vwall(18, 18, 22),
      ...vwall(22, 3,  7), ...vwall(22, 17, 22),
      ...vwall(29, 3, 22),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[3,5],[6,9],[9,5],[13,12],[16,9],[20,12],[23,5],[27,9],[28,15]] as [number,number][],
  },
  // Level 10: Final Serpent Arena — open arena, 4 enemies, fast
  {
    name: 'FINAL: Serpent Arena',
    survivalGoal: 999, snakeCount: 4, snakeTickMs: 180, glorySpeed: 3.0, lives: 1, scoreMultiplier: 3, fogOfWar: false,
    walls: [
      ...hwall(3,  2, 30), ...hwall(21, 2, 30),
      ...vwall(2,  3, 21), ...vwall(30, 3, 21),
      ...vwall(8,  5,  7), ...vwall(8,  17, 19),
      ...vwall(14, 9, 11), ...vwall(14, 13, 15),
      ...vwall(20, 5,  7), ...vwall(20, 17, 19),
      ...vwall(26, 9, 11), ...vwall(26, 13, 15),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 3, row: 12 },
    exitZone:   { col: 29, row: 12 },
    collectibles: [[5,7],[5,17],[10,5],[10,19],[15,12],[18,7],[18,17],[23,5],[23,19],[27,12]] as [number,number][],
  },

  // ── EXPLORER BONUS ──────────────────────────────────────────────────────

  // Level 11: Fruit Rush — huge open field, loads of food, relaxed time
  {
    name: 'Fruit Rush', isBonus: true,
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 600, glorySpeed: 2.0, lives: 5, scoreMultiplier: 2, fogOfWar: false,
    walls: [
      ...hwall(1, 1, 30), ...hwall(22, 1, 30),
      ...vwall(1, 1, 22), ...vwall(30, 1, 22),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 2, row: 12 },
    exitZone:   { col: 29, row: 12 },
    collectibles: [
      [4,3],[7,3],[10,3],[13,3],[16,3],[19,3],[22,3],[25,3],[28,3],
      [4,7],[7,7],[10,7],[13,7],[16,7],[19,7],[22,7],[25,7],[28,7],
      [4,12],[7,12],[13,12],[19,12],[25,12],[28,12],
      [4,17],[7,17],[10,17],[13,17],[16,17],[19,17],[22,17],[25,17],[28,17],
      [4,21],[7,21],[10,21],[13,21],[16,21],[19,21],[22,21],
    ] as [number,number][],
    bushes: [[6,5],[14,9],[22,5],[8,15],[18,19],[26,11]],
  },
  // Level 12: Practice Field — open canvas, no walls, free roam
  {
    name: 'Practice Field', isBonus: true,
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 600, glorySpeed: 2.0, lives: 5, scoreMultiplier: 1, fogOfWar: false,
    walls: [],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 2, row: 12 },
    exitZone:   { col: 30, row: 4 },
    collectibles: [[5,8],[10,4],[15,8],[20,4],[25,8],[10,16],[20,16],[15,12]] as [number,number][],
    bushes: [[6,6],[12,10],[18,6],[24,14],[8,18],[16,14]],
  },

  // ── SURVIVOR BONUS ──────────────────────────────────────────────────────

  // Level 13: Hunter Chase — 1 very fast enemy that chases relentlessly
  {
    name: 'Hunter Chase', isBonus: true,
    survivalGoal: 999, snakeCount: 1, snakeTickMs: 160, glorySpeed: 2.5, lives: 2, scoreMultiplier: 2, fogOfWar: false,
    walls: [
      ...hwall(7, 3, 29), ...hwall(17, 3, 29),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,12],[7,11],[11,13],[15,11],[19,13],[23,11],[27,12]] as [number,number][],
    bushes: [[6,13],[14,11],[22,13]],
  },
  // Level 14: Timed Escape — 2 enemies, tight corridor, 1 life
  {
    name: 'Timed Escape', isBonus: true,
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 220, glorySpeed: 2.5, lives: 1, scoreMultiplier: 3, fogOfWar: false,
    walls: [
      ...hwall(8, 3, 29), ...hwall(16, 3, 29),
      ...vwall(10, 8, 16), ...vwall(20, 8, 16),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,12],[8,9],[12,13],[16,9],[20,13],[24,9],[27,12]] as [number,number][],
  },
  // Level 15: Trap Field — poison traps hidden in path, 2 enemies
  {
    name: 'Trap Field', isBonus: true,
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 240, glorySpeed: 2.5, lives: 2, scoreMultiplier: 2, fogOfWar: false,
    walls: [
      ...hwall(7, 3, 29), ...hwall(17, 3, 29),
    ],
    poisonTiles: [
      [5,10],[5,11],[5,13],[5,14],
      [10,10],[10,14],[15,10],[15,14],
      [20,10],[20,11],[20,13],[20,14],
      [25,10],[25,14],
    ] as [number,number][],
    iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[3,12],[7,12],[12,12],[17,12],[22,12],[28,12]] as [number,number][],
  },

  // ── LEGEND BONUS ────────────────────────────────────────────────────────

  // Level 16: Poison Run — navigate through toxic tile gauntlet
  {
    name: 'Poison Run', isBonus: true,
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 200, glorySpeed: 3.0, lives: 2, scoreMultiplier: 3, fogOfWar: false,
    walls: [
      ...hwall(8, 3, 29), ...hwall(16, 3, 29),
    ],
    poisonTiles: [
      [6,10],[6,11],[6,13],[6,14],
      [11,10],[11,11],[11,13],[11,14],
      [16,10],[16,11],[16,13],[16,14],
      [21,10],[21,11],[21,13],[21,14],
      [26,10],[26,11],[26,13],[26,14],
    ] as [number,number][],
    iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,12],[8,12],[14,12],[19,12],[24,12],[28,12]] as [number,number][],
  },
  // Level 17: Mirror Maze — controls reversed + maze + 2 enemies
  {
    name: 'Mirror Maze', isBonus: true,
    survivalGoal: 999, snakeCount: 2, snakeTickMs: 220, glorySpeed: 2.8, lives: 1, scoreMultiplier: 3, fogOfWar: false,
    reversedControls: true,
    walls: [
      ...hwall(4,  2, 14), ...hwall(4,  16, 30),
      ...hwall(10, 6, 18), ...hwall(16, 2, 12),
      ...hwall(16, 14, 28), ...hwall(22, 6, 20),
      ...vwall(6,  4, 10), ...vwall(12, 10, 16),
      ...vwall(18, 4, 10), ...vwall(24, 10, 22),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 1 },
    exitZone:   { col: 30, row: 22 },
    collectibles: [[3,5],[6,12],[9,18],[14,5],[18,12],[22,18],[27,12]] as [number,number][],
  },
  // Level 18: Double Speed — everything blazing fast
  {
    name: 'Double Speed', isBonus: true,
    survivalGoal: 999, snakeCount: 3, snakeTickMs: 130, glorySpeed: 3.5, lives: 1, scoreMultiplier: 3, fogOfWar: false,
    walls: [
      ...hwall(8, 3, 29), ...hwall(16, 3, 29),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: true,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[4,12],[8,11],[12,13],[16,11],[20,13],[24,11],[28,12]] as [number,number][],
  },
  // Level 19: No Vision — almost completely dark, 3 enemies
  {
    name: 'No Vision', isBonus: true,
    survivalGoal: 999, snakeCount: 3, snakeTickMs: 200, glorySpeed: 2.8, lives: 1, scoreMultiplier: 3, fogOfWar: true,
    walls: [
      ...hwall(8,  3, 29), ...hwall(9,  3, 29),
      ...hwall(15, 3, 29), ...hwall(16, 3, 29),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 1, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[5,12],[10,11],[15,13],[20,11],[25,13],[28,12]] as [number,number][],
  },
  // Level 20: Endless Arena — survive 3 minutes vs 5 enemies (no exit)
  {
    name: 'Endless Arena', isBonus: true,
    survivalGoal: 180, snakeCount: 5, snakeTickMs: 175, glorySpeed: 3.0, lives: 1, scoreMultiplier: 4, fogOfWar: false,
    walls: [
      ...hwall(3, 2, 30), ...hwall(21, 2, 30),
      ...vwall(2, 3, 21), ...vwall(30, 3, 21),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: true, speedRamp: true,
    gloryStart: { col: 3, row: 12 },
    collectibles: [[6,6],[10,6],[15,6],[20,6],[25,6],[6,18],[10,18],[15,18],[20,18],[25,18],[15,12]] as [number,number][],
  },
];

let gameLevel: number = 1;

type PowerUpKind = 'flashlight' | 'trap' | 'speed' | 'hint' | 'pistol' | 'stick' | 'smoke';
type FruitKind = 'apple' | 'banana' | 'berry';

interface Bullet {
  x: number; y: number;    // start pixel
  tx: number; ty: number;  // target pixel
  progress: number;        // 0 → 1 travel animation
  done: boolean;
  targetId: number;        // snake id to stun on hit
}

interface Point { x: number; y: number; }

interface SnakeEnemy {
  id: number;
  segments: Point[];
  prevSegments: Point[];     // positions before last step — used for smooth interpolation
  lerpT: number;             // 0→1 between last step and next; drives render interpolation
  alive: boolean;
  stunnedMs: number;
  color: number;
  isBoss: boolean;
  behavior: SnakeBehavior;   // movement AI type
  tickMs: number;            // ms per move step (for per-snake timing)
  tickAccumMs: number;       // accumulated ms since last step
  emerged: boolean;          // false = hiding in spawn bush, waiting for Glory
  retreating: boolean;       // true = heading back to spawn bush
  awake: boolean;            // false = sleeping (sleeper behavior only); wakes on proximity
  spawnCol: number;          // bush spawn position
  spawnRow: number;
  baseTick: number;          // original tick speed used for progressive scaling
  // patrol state (used only when behavior === 'patrol')
  patrolA: Point;
  patrolB: Point;
  patrolGoal: 'A' | 'B';    // which waypoint to walk toward next
}

interface GloryState {
  x: number;
  y: number;
  speed: number;
  lives: number;
  invincibleMs: number;
}

interface ActivePowerUp {
  kind: PowerUpKind;
  msRemaining: number;
}

interface TrapState {
  x: number;
  y: number;
}

const SNAKE_COLORS = [
  0x7CFF4F,  // vivid green
  0xFF5AAE,  // hot pink
  0x4db82e,  // deep green
  0xff2288,  // deep pink
  0xcc44ff,  // purple
  0x00eeff,  // cyan
  0xffcc00,  // gold
  0xff6600,  // orange
];

const TERRAIN_ROCKS: Array<{ x: number; y: number; rw: number; rh: number }> = [
  { x: 80,  y: 60,  rw: 50, rh: 30 },
  { x: 500, y: 100, rw: 60, rh: 36 },
  { x: 200, y: 380, rw: 40, rh: 24 },
  { x: 550, y: 350, rw: 56, rh: 32 },
  { x: 340, y: 200, rw: 44, rh: 28 },
  { x: 120, y: 240, rw: 36, rh: 20 },
  { x: 450, y: 420, rw: 48, rh: 30 },
  { x: 280, y: 80,  rw: 38, rh: 22 },
  { x: 600, y: 240, rw: 32, rh: 18 },
];

class VenomArenaScene extends Phaser.Scene {
  private glory!: GloryState;
  private snakes: SnakeEnemy[] = [];

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private topGraphics!: Phaser.GameObjects.Graphics;

  private overlayText!: Phaser.GameObjects.Text;

  private joystickActive = false;
  private dragDir: { dx: number; dy: number } | null = null;
  private joystickDist = 0;          // raw deflection magnitude (0–39); used for stealth detection
  private gloryStealthMode = false;  // true when sneaking (slow + reduced snake detection radius)
  private shiftKeyDown = false;      // keyboard: hold Shift to sneak
  private gloryTrail: Array<{x: number; y: number}> = [];
  private gloryTrailMax = 2;  // starts small, grows as apples are eaten

  private snakeTickTimer: Phaser.Time.TimerEvent | null = null;

  private survivalMs = 0;
  private score = 0;
  private roundOver = false;

  private activePowerUp: ActivePowerUp | null = null;
  private berryInvisibleMs = 0;   // countdown for berry invisibility (snakes can't see Glory)
  private smokeActiveMs = 0;      // countdown for smoke bomb — full invisibility (even up-close)
  private stickSwingMs = 0;       // brief visual flash after stick swing
  private houseKey: { col: number; row: number; taken: boolean } | null = null;
  private escapeRushActive = false;
  private escapeRushMs = 0;       // counts up once rush begins (for visual effects)
  // ── Audio (Web Audio API — no external files needed) ─────────────────────
  private audioCtx: AudioContext | null = null;
  private snakeHissTimerMs = 0;   // cooldown between hiss sounds
  private footstepTimerMs = 0;    // cooldown between footstep ticks
  private jumpScareFlashMs = 0;   // white flash countdown after sleeper wakes
  private trap: TrapState | null = null;
  private waitingForTrapPlacement = false;

  private susieCooldownMs = 5000;
  private susieOfferActive = false;
  private currentPowerUpOffer: PowerUpKind = 'flashlight';
  private powerUpIndex = 0;
  private powerUpOfferTimeout: ReturnType<typeof setTimeout> | null = null;

  private spawnAccumMs = 0;
  private readonly SPAWN_INTERVAL_MS = 15000;

  private domListeners: Array<{ el: Element | Window; event: string; fn: EventListener }> = [];

  // New fields for expanded levels
  private walls: Set<string> = new Set();
  private poisonTiles: Set<string> = new Set();
  private iqGates: Array<{ col: number; row: number; open: boolean; challenge: Challenge }> = [];
  private movingWalls: Array<{ col: number; row: number; col2: number; row2: number; timer: number; interval: number }> = [];
  private fogOfWar = false;
  private poisonContactMs = 0;
  private speedRampTimer = 0;
  private speedRampFactor = 1.0;
  private challengeActive = false;
  private pendingIQGate: { col: number; row: number; open: boolean; challenge: Challenge } | null = null;
  private challengeTimerMs = 0;
  private readonly CHALLENGE_DURATION_MS = 10000;
  private tongueTimer = 0;

  // Exit-zone + collectible system
  private exitZone: { col: number; row: number } | null = null;
  private collectibles: Array<{ col: number; row: number; collected: boolean; kind: FruitKind }> = [];
  private bushCells: Set<string> = new Set();
  private hiddenInBush = false;
  private hidingSuccess = false;          // true only after correctly answering the hide challenge
  private lastBushKey: string | null = null;
  private bushChallengeAnswered = false;  // prevents re-triggering while inside same bush
  private hidingSearchMs = 0;            // penalty countdown after a failed hide answer (ms remaining)
  private readonly HIDING_DURATION_MS = 4500;
  private challengeType: 'iqgate' | 'hide' | null = null;
  private exitPuzzleSolved = false;
  private snakePenaltyMs = 0;
  private usePerSnakeTick = false;
  private facingAngle = 0;
  private exitPulseTimer = 0;
  private hideSuccessTimerMs = 0;   // counts down after correct hide answer (check-sign animation)
  private gateOpen = false;         // Level 1 start gate — snakes don't emerge until opened
  private gateOpenAnimMs = 0;       // opening animation timer (counts up)
  private applesCollected = 0;          // how many apples Glory has eaten in Level 1
  private exitGateOpenAnimMs = -1;      // -1 = closed; ≥0 = opening animation timer

  // Pistol power-up
  private pistolPickups: Array<{ col: number; row: number; taken: boolean }> = [];
  private pistolBullets = 0;
  private bullets: Bullet[] = [];

  // Level 2 atmosphere — wind particles, fog scroll, wind sound timer
  private windParticles: Array<{ x: number; y: number; size: number; alpha: number; speed: number }> = [];
  private fogScrollMs  = 0;
  private windTimerMs  = 0;

  // Level 2 balance mechanic — velocity / momentum fields
  private gloryVx = 0;
  private gloryVy = 0;

  // Level 2 falling rocks
  private fallingRocks: Array<{ x: number; y: number; vy: number; size: number; alpha: number }> = [];
  private rockSpawnTimer = 0;

  // Level 2 wind push (zone-aware)
  private windGustActive = 0;   // ms remaining for current gust
  private windGustDir    = 1;   // +1 = right, -1 = left
  private windGustTimer  = 0;   // ms until next gust
  // Wind is stronger in exposed connector areas (cols 12-16, 19-23)
  private static WIND_STRONG_X_RANGES: Array<[number, number]> = [[240, 320], [380, 460]];

  // Level 2 unstable path — crumbling trail sections
  private unstableCells: Array<{
    col: number; row: number;
    phase: 'stable' | 'cracking' | 'collapsed' | 'recovering';
    timerMs: number;   // ms until next phase transition
  }> = [];
  private collapsedCells = new Set<string>(); // 'col,row' → temporarily blocks movement
  // Predefined trail cells that cycle through crack → collapse → recover
  private static UNSTABLE_CELL_DEFS: Array<[number, number]> = [
    // Upper-left corridor (rows 5-6, 2 rows wide) — alternate rows, never same column
    [5,  6],   // bottom row only — top row [5,5] stays clear
    [10, 5],   // top row only — bottom row [10,6] stays clear
    // Connector 1 (cols 12-15, rows 7-14) — wide enough, single cells fine
    [13, 10],
    // Middle trail (rows 15-16, 2 rows wide) — alternate rows
    [16, 15],  // top row only — [16,16] stays clear
    [19, 16],  // bottom row only — [19,15] stays clear
    // Connector 2 (cols 20-22, rows 6-16) — single cells, plenty of room
    [21, 9], [21, 12],
    // Upper-right corridor (rows 5-6, 2 rows wide) — alternate rows
    [25, 5],   // top row only
    [28, 6],   // bottom row only
  ];

  private static LEVEL3_UNSTABLE_CELL_DEFS: Array<[number, number]> = [
    // Bridge 1 planks
    [5, 4],  [8, 5],  [14, 4],
    // Connector 1
    [11, 8], [12, 10],
    // Bridge 2 planks
    [9, 13], [15, 14], [21, 13],
    // Dead-end branch
    [20, 8],
    // Bridge 3 planks
    [16, 19], [22, 20], [26, 19],
  ];

  // Level 2 constant-chase: hunters respawn at left edge after dying/retreating
  private hunterRespawnQueue: Array<{ timerMs: number; cfg: {
    behavior: 'hunter'; tickMs: number; startCol: number; startRow: number; color: number;
  }}> = [];

  // Level 2 edge-danger: precarious ledge tiles along trail margins
  // Phase: 0=safe, 1=crumbling (Glory on it), 2=broken (deals damage)
  private edgeDangerMs   = 0;   // ms Glory has stood on a danger cell
  private edgeDangerWarn = false;
  private static EDGE_DANGER_CELLS: Array<[number, number]> = [
    // Upper-left corridor edges (top & bottom row)
    [4, 4], [7, 4], [10, 4], [11, 7], [8, 7],
    // Middle trail edges
    [14, 14], [17, 14], [19, 17], [16, 17],
    // Upper-right corridor edges
    [23, 4], [26, 4], [29, 7],
  ];

  // Level 2 forward-pressure: if Glory stalls, snakes speed up briefly
  private lastForwardX   = 0;   // last recorded x when tracking stall
  private stallTimerMs   = 0;   // ms without meaningful forward progress
  private stallWarningMs = 0;   // countdown for "KEEP MOVING!" UI flash
  private stallBoostMs   = 0;   // countdown for snake speed penalty

  // Level 3 — Bamboo Bridge Maze
  private bridgeCreakTimerMs = 0;  // countdown until next creak sound
  private pathGlowMs = 0;          // ms remaining for berry path-reveal glow
  private level3StillMs = 0;       // ms Glory hasn't moved — triggers creak

  // Heartbeat (any level, 1 life remaining)
  private heartbeatTimerMs = 0;

  // Bite / fall animation
  private gloryFallMs = 0;    // counts down from 1200 → 0 after a snake bite

  constructor() {
    super({ key: 'VenomArenaScene' });
  }

  create(): void {
    this.bgGraphics     = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.topGraphics    = this.add.graphics();

    this.overlayText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '30px',
      color: '#ffffff',
      align: 'center',
      fontFamily: 'system-ui, sans-serif',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    this.initGame();
    this.setupInput();
    this.setupDomListeners();

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.classList.add('hidden');

    const susieBubble = document.getElementById('susie-bubble');
    if (susieBubble) susieBubble.classList.add('hidden');

    this.updateDOM();
  }

  private initGame(): void {
    const config = LEVEL_CONFIGS[gameLevel - 1];

    this.glory = {
      x: config.gloryStart
        ? config.gloryStart.col * CELL_SIZE + CELL_SIZE / 2
        : CANVAS_W / 2,
      y: config.gloryStart
        ? config.gloryStart.row * CELL_SIZE + CELL_SIZE / 2
        : CANVAS_H / 2,
      speed: config.glorySpeed,
      lives: config.lives,
      invincibleMs: 0,
    };
    this.gloryTrail = [];
    this.gloryTrailMax = 2;  // reset to tiny at start of each level

    this.snakes = [];
    if (config.snakeEnemyConfigs) {
      // Level has per-snake behavior configs — spawn each with its own AI/speed
      this.usePerSnakeTick = true;
      for (const ec of config.snakeEnemyConfigs) {
        this.spawnSnake(false, ec);
      }
    } else {
      this.usePerSnakeTick = false;
      for (let i = 0; i < config.snakeCount; i++) {
        this.spawnSnake();
      }
    }
    if (config.hasBoss) {
      this.spawnSnake(true);
    }

    // Initialize walls
    this.walls = new Set();
    for (const [col, row] of config.walls) {
      this.walls.add(`${col},${row}`);
    }

    // Initialize poison tiles
    this.poisonTiles = new Set();
    for (const [col, row] of config.poisonTiles) {
      this.poisonTiles.add(`${col},${row}`);
    }

    // Initialize IQ gates (Level 1 uses random riddles from indices 10-14)
    this.iqGates = config.iqGatePositions.map(g => ({
      col: g.col,
      row: g.row,
      open: false,
      challenge: gameLevel === 1 && !config.houseLayout
        ? CHALLENGES[10 + Math.floor(Math.random() * 5)]
        : CHALLENGES[g.challengeIdx % CHALLENGES.length],
    }));
    // Add closed IQ gate positions to walls
    for (const gate of this.iqGates) {
      this.walls.add(`${gate.col},${gate.row}`);
    }

    // Initialize moving walls
    this.movingWalls = config.movingWallConfigs.map(mw => ({
      col: mw.col, row: mw.row,
      col2: mw.col2, row2: mw.row2,
      timer: 0, interval: mw.intervalMs,
    }));
    for (const mw of this.movingWalls) {
      this.walls.add(`${mw.col},${mw.row}`);
    }

    this.fogOfWar = config.fogOfWar;
    this.poisonContactMs = 0;
    this.speedRampTimer = 0;
    this.speedRampFactor = 1.0;
    this.challengeActive = false;
    this.pendingIQGate = null;
    this.challengeTimerMs = 0;

    // Exit zone + collectibles
    this.exitZone = config.exitZone ?? null;
    this.collectibles = (config.collectibles ?? []).map(([col, row, kind]) => ({ col, row, collected: false, kind: kind ?? 'apple' }));
    this.bushCells = new Set((config.bushes ?? []).map(([c, r]) => `${c},${r}`));
    this.hiddenInBush = false;
    this.hidingSuccess = false;
    this.lastBushKey = null;
    this.bushChallengeAnswered = false;
    this.hidingSearchMs = 0;
    this.hideSuccessTimerMs = 0;
    this.gateOpen = config.houseLayout ? true : (gameLevel !== 1);   // house/non-L1 start open; old L1 locked
    this.gateOpenAnimMs = 0;
    this.applesCollected = 0;
    this.exitGateOpenAnimMs = -1;
    this.exitPulseTimer = 0;
    this.exitPuzzleSolved = false;
    this.snakePenaltyMs = 0;

    // House exit is always open — no puzzle lock
    this.exitPuzzleSolved = true;

    // Pistol pickups — 2 guns hidden on the Level 1 path
    this.pistolPickups = (gameLevel === 1 && !config.houseLayout)
      ? [{ col: 7, row: 7, taken: false }, { col: 24, row: 20, taken: false }]
      : [];
    this.pistolBullets = 0;
    this.bullets = [];
    this.gloryFallMs = 0;
    this.gloryVx = 0;
    this.gloryVy = 0;
    this.hunterRespawnQueue = [];
    this.collapsedCells = new Set();
    // Initialise unstable cells with staggered timers so they don't all crack at once
    const cellDefs = gameLevel === 3
      ? VenomArenaScene.LEVEL3_UNSTABLE_CELL_DEFS
      : VenomArenaScene.UNSTABLE_CELL_DEFS;
    this.unstableCells = (gameLevel === 2 || gameLevel === 3)
      ? cellDefs.map(([col, row], i) => ({
          col, row, phase: 'stable' as const,
          timerMs: 5000 + i * 1200 + Math.random() * 3000,
        }))
      : [];
    this.heartbeatTimerMs = 0;
    this.fallingRocks = [];
    this.rockSpawnTimer = 0;
    this.windGustActive = 0;
    this.windGustTimer  = 4000;
    this.windGustDir    = 1;
    this.edgeDangerMs   = 0;
    this.edgeDangerWarn = false;
    this.lastForwardX   = this.glory.x;
    this.stallTimerMs   = 0;
    this.stallWarningMs = 0;
    this.stallBoostMs   = 0;
    this.bridgeCreakTimerMs = 3000 + Math.random() * 2000;
    this.pathGlowMs = 0;
    this.level3StillMs = 0;
    this.updatePistolHUD();

    this.survivalMs = 0;
    this.score = 0;
    this.roundOver = false;
    this.activePowerUp = null;
    this.berryInvisibleMs = 0;
    this.smokeActiveMs = 0;
    this.stickSwingMs = 0;
    this.escapeRushActive = false;
    this.escapeRushMs = 0;
    this.snakeHissTimerMs = 0;
    this.footstepTimerMs = 0;
    this.jumpScareFlashMs = 0;
    this.houseKey = config.houseLayout
      ? { col: 20, row: 17, taken: false }  // hidden in SE room
      : null;
    this.trap = null;
    this.waitingForTrapPlacement = false;
    this.susieCooldownMs = 5000;
    this.susieOfferActive = false;
    this.spawnAccumMs = 0;
    // House layout gets tools suited for close-quarters combat; other levels get exploration tools
    this.POWER_UP_ROTATION = config.houseLayout
      ? ['stick', 'smoke', 'trap', 'speed']
      : ['flashlight', 'trap', 'speed', 'hint'];
    this.dragDir = null;
    this.facingAngle = 0;    // start facing right; first drag will smoothly turn Glory
    this.joystickActive = false;

    this.startSnakeTimer(config.snakeTickMs);

    // Show level banner text if configured
    if (config.bannerText) {
      this.overlayText.setText(config.bannerText);
      this.overlayText.setVisible(true);
      this.time.delayedCall(2500, () => { this.overlayText.setVisible(false); });
    }

    // Level 2 — "Edge of Survival" atmosphere init
    if (gameLevel === 2) {
      this.fogScrollMs  = 0;
      this.windTimerMs  = 2200;
      this.windParticles = Array.from({ length: 32 }, () => ({
        x:     Math.random() * CANVAS_W,
        y:     90 + Math.random() * 340,
        size:  1.0 + Math.random() * 2.2,
        alpha: 0.07 + Math.random() * 0.25,
        speed: 0.5 + Math.random() * 1.5,
      }));
      // Cinematic intro — quiet → hiss → "run"
      this.overlayText.setText('…silence.\nToo quiet…');
      this.overlayText.setVisible(true);
      this.time.delayedCall(1600, () => {
        this.playHiss(0.6);
        this.overlayText.setText('🐍 Hissing behind you…');
        this.time.delayedCall(1200, () => {
          this.overlayText.setText('🌄 NARROW TRAIL\nThey followed you — RUN! 🏃‍♀️');
          this.time.delayedCall(1500, () => this.overlayText.setVisible(false));
        });
      });
    } else {
      this.windParticles = [];
    }
  }

  private startSnakeTimer(tickMs: number): void {
    this.snakeTickTimer?.remove();
    this.snakeTickTimer = this.time.addEvent({
      delay: tickMs,
      callback: this.tickSnakes,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnSnake(isBoss = false, cfg?: SnakeEnemyConfig): void {
    const id = this.snakes.length;
    const color = isBoss ? 0xff2200 : (cfg?.color ?? SNAKE_COLORS[id % SNAKE_COLORS.length]);
    let hx: number, hy: number;
    if (cfg) {
      hx = cfg.startCol;
      hy = cfg.startRow;
    } else {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0)      { hx = Math.floor(Math.random() * COLS); hy = 0; }
      else if (edge === 1) { hx = COLS - 1; hy = Math.floor(Math.random() * ROWS); }
      else if (edge === 2) { hx = Math.floor(Math.random() * COLS); hy = ROWS - 1; }
      else                 { hx = 0; hy = Math.floor(Math.random() * ROWS); }

      const gc = this.gloryCell();
      if (Math.abs(hx - gc.x) < 5 && Math.abs(hy - gc.y) < 5) {
        hx = (hx + COLS / 2) % COLS;
        hy = (hy + ROWS / 2) % ROWS;
      }
    }

    const segs: Point[] = Array.from({ length: 4 }, () => ({ x: hx, y: hy }));
    const useBushSpawn = this.usePerSnakeTick && !!cfg;
    const isSleeper = cfg?.behavior === 'sleeper';
    this.snakes.push({
      id, segments: segs, prevSegments: segs.map(s => ({ ...s })), lerpT: 1,
      alive: true, stunnedMs: 0, color, isBoss,
      behavior: cfg?.behavior ?? 'chaser',
      tickMs: cfg?.tickMs ?? 600,
      baseTick: cfg?.tickMs ?? 600,
      tickAccumMs: Math.random() * (cfg?.tickMs ?? 600),
      emerged: isSleeper ? true : !useBushSpawn,  // sleepers visible from the start; others hide in bushes
      retreating: false,
      awake: !isSleeper,   // sleepers start asleep; all others are already "awake"
      spawnCol: hx,
      spawnRow: hy,
      patrolA: cfg?.patrolA ? { x: cfg.patrolA.col, y: cfg.patrolA.row } : { x: hx, y: hy },
      patrolB: cfg?.patrolB ? { x: cfg.patrolB.col, y: cfg.patrolB.row } : { x: hx, y: hy },
      patrolGoal: 'B',
    });
  }

  private gloryCell(): Point {
    return {
      x: Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE))),
      y: Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE))),
    };
  }

  private isWallOrClosedGate(col: number, row: number): boolean {
    if (this.walls.has(`${col},${row}`)) return true;
    // Collapsed cells are NOT walls — Glory passes through but takes damage
    for (const gate of this.iqGates) {
      if (!gate.open && gate.col === col && gate.row === row) return true;
    }
    return false;
  }

  private setupInput(): void {
    // Phaser input: only used for trap placement clicks on canvas
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.waitingForTrapPlacement) {
        this.placeTrap(ptr.x, ptr.y);
      }
    });

    // Virtual joystick via DOM
    const base  = document.getElementById('joystick-base');
    const knob  = document.getElementById('joystick-knob');
    if (!base || !knob) return;

    const KNOB_MAX = 39; // max knob travel from center (base radius - knob radius)
    let baseRect = base.getBoundingClientRect();
    let activePtrId: number | null = null;

    const onStart = (e: PointerEvent): void => {
      if (activePtrId !== null) return;
      activePtrId = e.pointerId;
      base.setPointerCapture(e.pointerId);
      baseRect = base.getBoundingClientRect();
      this.joystickActive = true;
      knob.classList.add('active');
      moveKnob(e.clientX, e.clientY);
    };

    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== activePtrId) return;
      moveKnob(e.clientX, e.clientY);
    };

    const onEnd = (e: PointerEvent): void => {
      if (e.pointerId !== activePtrId) return;
      activePtrId = null;
      this.joystickActive = false;
      this.dragDir = null;
      this.joystickDist = 0;
      knob.style.transform = 'translate(-50%, -50%)';
      knob.classList.remove('active');
    };

    const moveKnob = (clientX: number, clientY: number): void => {
      const cx = baseRect.left + baseRect.width  / 2;
      const cy = baseRect.top  + baseRect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      this.joystickDist = Math.min(dist, KNOB_MAX);
      if (dist > KNOB_MAX) {
        dx = (dx / dist) * KNOB_MAX;
        dy = (dy / dist) * KNOB_MAX;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      if (dist > 6) {
        const len = Math.hypot(dx, dy);
        this.dragDir = { dx: dx / len, dy: dy / len };
      } else {
        this.dragDir = null;
      }
    };

    base.addEventListener('pointerdown', onStart);
    base.addEventListener('pointermove', onMove);
    base.addEventListener('pointerup',   onEnd);
    base.addEventListener('pointercancel', onEnd);

    this.domListeners.push(
      { el: base, event: 'pointerdown',   fn: onStart as EventListener },
      { el: base, event: 'pointermove',   fn: onMove  as EventListener },
      { el: base, event: 'pointerup',     fn: onEnd   as EventListener },
      { el: base, event: 'pointercancel', fn: onEnd   as EventListener },
    );
  }

  private placeTrap(px: number, py: number): void {
    this.trap = { x: px, y: py };
    this.waitingForTrapPlacement = false;
    this.activePowerUp = { kind: 'trap', msRemaining: 20000 };
  }

  private setupDomListeners(): void {
    const retryFn = () => { this.resetGame(); };
    window.addEventListener('snake-retry', retryFn as EventListener);
    this.domListeners.push({ el: window, event: 'snake-retry', fn: retryFn as EventListener });

    const susieBtn = document.getElementById('susie-powerup-btn');
    if (susieBtn) {
      const fn = () => { this.activatePowerUp(this.currentPowerUpOffer); };
      susieBtn.addEventListener('click', fn);
      this.domListeners.push({ el: susieBtn, event: 'click', fn });
    }

    // Pistol fire button
    const pistolBtn = document.getElementById('pistol-btn');
    if (pistolBtn) {
      const fn = () => { this.firePistol(); };
      pistolBtn.addEventListener('click', fn);
      this.domListeners.push({ el: pistolBtn, event: 'click', fn });
    }

    // Keyboard Shift = sneak (hold to enter stealth mode)
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') this.shiftKeyDown = true; };
    const onKeyUp   = (e: KeyboardEvent) => { if (e.key === 'Shift') this.shiftKeyDown = false; };
    window.addEventListener('keydown', onKeyDown as EventListener);
    window.addEventListener('keyup',   onKeyUp   as EventListener);
    this.domListeners.push({ el: window, event: 'keydown', fn: onKeyDown as EventListener });
    this.domListeners.push({ el: window, event: 'keyup',   fn: onKeyUp   as EventListener });
  }

  private tickSnakes(): void {
    if (this.roundOver) return;
    if (this.usePerSnakeTick) return;  // handled per-frame in update()
    const gc = this.gloryCell();

    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      if (snake.stunnedMs > 0) continue;

      const movesPerTick = snake.isBoss ? 2 : 1;
      for (let m = 0; m < movesPerTick; m++) {
        this.moveSnakeStep(snake, gc);
      }
    }
  }

  private moveSnakeStep(snake: SnakeEnemy, gc: Point): void {
    // Save current positions for smooth interpolation
    snake.prevSegments = snake.segments.map(s => ({ ...s }));
    snake.lerpT = 0;

    const head = snake.segments[0];

    // ── Retreat: snake heads back to its spawn bush ──────────────────────
    if (snake.retreating) {
      const distToSpawn = Math.abs(head.x - snake.spawnCol) + Math.abs(head.y - snake.spawnRow);
      if (distToSpawn <= 0) {
        snake.retreating = false;
        snake.emerged    = false;
        // Reset all segments to spawn position so snake collapses back into bush
        for (let i = 0; i < snake.segments.length; i++) {
          snake.segments[i] = { x: snake.spawnCol, y: snake.spawnRow };
        }
        return;
      }
      // Move one step toward spawn
      const ddx = snake.spawnCol - head.x;
      const ddy = snake.spawnRow - head.y;
      let nx2 = head.x, ny2 = head.y;
      if (Math.abs(ddx) >= Math.abs(ddy)) {
        const cand = head.x + Math.sign(ddx);
        if (!this.isWallOrClosedGate(cand, head.y)) { nx2 = cand; }
        else { const cand2 = head.y + Math.sign(ddy || 1);
               if (!this.isWallOrClosedGate(head.x, cand2)) ny2 = cand2; }
      } else {
        const cand = head.y + Math.sign(ddy);
        if (!this.isWallOrClosedGate(head.x, cand)) { ny2 = cand; }
        else { const cand2 = head.x + Math.sign(ddx || 1);
               if (!this.isWallOrClosedGate(cand2, head.y)) nx2 = cand2; }
      }
      for (let i = snake.segments.length - 1; i > 0; i--) snake.segments[i] = { ...snake.segments[i - 1] };
      snake.segments[0] = { x: nx2, y: ny2 };
      return;
    }

    // ── Waiting: emerge when triggered (non-default L1 = first fruit; others = gate + proximity) ─
    if (!snake.emerged) {
      let canEmerge: boolean;
      if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) {
        canEmerge = this.applesCollected > 0;   // any fruit eaten → all snakes notice
      } else {
        const distToGlory = Math.abs(head.x - gc.x) + Math.abs(head.y - gc.y);
        canEmerge = this.gateOpen && distToGlory <= 6;
      }
      if (canEmerge) {
        snake.emerged = true;
      } else {
        return;
      }
    }

    let nx = head.x;
    let ny = head.y;

    // Snakes lose the player's exact location while she's hidden — unless the
    // hiding timer has expired (they start searching her last known position).
    const effectivelyHidden = this.hiddenInBush && this.hidingSuccess;
    // Smoke bomb — full invisibility, even up close (unlike stealth which only works >2.5 cells)
    const smokeHidden = this.smokeActiveMs > 0;
    // Stealth: sneaking Glory is undetectable to snakes more than 2.5 cells away
    const stealthDist = Math.hypot(head.x - gc.x, head.y - gc.y);
    const stealthHidden = this.gloryStealthMode && stealthDist > 2.5;
    const undetected = effectivelyHidden || smokeHidden || stealthHidden;

    const tryMove = (cx: number, cy: number): void => {
      // Try primary axis first, then secondary
      const dx = cx - head.x;
      const dy = cy - head.y;
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const cand = head.x + Math.sign(dx);
        if (!this.isWallOrClosedGate(cand, head.y)) { nx = cand; return; }
        const cand2 = head.y + Math.sign(dy !== 0 ? dy : 1);
        if (!this.isWallOrClosedGate(head.x, cand2)) { ny = cand2; }
      } else {
        const cand = head.y + Math.sign(dy);
        if (!this.isWallOrClosedGate(head.x, cand)) { ny = cand; return; }
        const cand2 = head.x + Math.sign(dx !== 0 ? dx : 1);
        if (!this.isWallOrClosedGate(cand2, head.y)) { nx = cand2; }
      }
    };

    const randomStep = (): void => {
      const dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}];
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      const cx = head.x + d.dc;
      const cy = head.y + d.dr;
      if (!this.isWallOrClosedGate(cx, cy)) { nx = cx; ny = cy; }
    };

    if (snake.behavior === 'slow') {
      // 🟢 Slow Snake: plodding chaser — always moves toward Glory, never speeds up
      if (undetected) {
        randomStep();
      } else {
        tryMove(gc.x, gc.y);
      }

    } else if (snake.behavior === 'hunter') {
      // 🔴 Hunter Snake: hyper-aggressive chaser — already scaled by apple factor in tickMs;
      //    uses 80% chase / 20% random to avoid getting permanently wall-stuck
      if (undetected) {
        randomStep();
      } else {
        if (Math.random() < 0.80) {
          tryMove(gc.x, gc.y);
        } else {
          randomStep();
        }
      }

    } else if (snake.behavior === 'patrol') {
      // 🟡 Patrol Snake: walks between two fixed waypoints; only chases when Glory is within 4 cells
      const distFromPlayer = Math.hypot(head.x - gc.x, head.y - gc.y);
      if (!undetected && distFromPlayer <= 4) {
        // Player too close — break pattern and chase
        tryMove(gc.x, gc.y);
      } else {
        // Walk toward current waypoint
        const wp = snake.patrolGoal === 'A' ? snake.patrolA : snake.patrolB;
        const atWp = head.x === wp.x && head.y === wp.y;
        if (atWp) {
          // Flip to the other waypoint
          snake.patrolGoal = snake.patrolGoal === 'A' ? 'B' : 'A';
        }
        const target = snake.patrolGoal === 'A' ? snake.patrolA : snake.patrolB;
        tryMove(target.x, target.y);
      }

    } else if (snake.behavior === 'random') {
      if (undetected) {
        randomStep();
      } else {
        // 45% chance to chase, 55% random — unpredictable but threatening
        if (Math.random() < 0.45) {
          tryMove(gc.x, gc.y);
        } else {
          randomStep();
        }
      }
    } else if (snake.behavior === 'guard') {
      const exitX = this.exitZone?.col ?? gc.x;
      const exitY = this.exitZone?.row ?? gc.y;
      const distFromExit = Math.hypot(head.x - exitX, head.y - exitY);
      const distFromPlayer = Math.hypot(head.x - gc.x, head.y - gc.y);
      if (!undetected && distFromPlayer < 7) {
        // Player is close — chase them
        tryMove(gc.x, gc.y);
      } else if (distFromExit > 6) {
        // Drifted too far from post — return
        tryMove(exitX, exitY);
      } else {
        // Patrol: random walk within guard radius
        randomStep();
      }

    } else if (snake.behavior === 'sleeper') {
      // 🟢 Sleeping snake — lies perfectly still until Glory steps within 3 cells, then lunges
      //    Stealth halves the wake radius — careful sneaking lets Glory grab nearby fruit!
      if (!snake.awake) {
        const distToGlory = Math.abs(head.x - gc.x) + Math.abs(head.y - gc.y);
        const wakeRadius = this.gloryStealthMode ? 1.5 : 3;
        if (distToGlory <= wakeRadius) {
          snake.awake = true;    // wake up! now hunts aggressively
          snake.tickMs = Math.max(180, Math.floor(snake.baseTick * 0.55));  // speed burst on wake
          // Jump scare: sound stab + camera shake + white flash
          this.playJumpScare();
          this.jumpScareFlashMs = 180;
          this.cameras.main.shake(220, 0.007);
        } else {
          return;  // stay coiled — do not move
        }
      }
      // Awake: relentless hunter chase
      if (!undetected && Math.random() < 0.85) {
        tryMove(gc.x, gc.y);
      } else {
        randomStep();
      }

    } else if (snake.behavior === 'sentry') {
      // 🔴 Sentry snake — guards its spawn post (placed near a key fruit); charges fast in radius 5
      const distFromPost   = Math.hypot(head.x - snake.spawnCol, head.y - snake.spawnRow);
      const distFromPlayer = Math.hypot(head.x - gc.x, head.y - gc.y);
      if (!undetected && distFromPlayer <= 5) {
        // Player in territory — charge!
        tryMove(gc.x, gc.y);
      } else if (distFromPost > 2) {
        // Drifted from post — return
        tryMove(snake.spawnCol, snake.spawnRow);
      } else {
        // Stay near post with minimal drift
        if (Math.random() < 0.25) randomStep();
      }

    } else {
      // 'chaser' (default): always chase Glory, random walk when hidden
      if (undetected) {
        randomStep();
      } else {
        tryMove(gc.x, gc.y);
      }
    }

    nx = Math.max(0, Math.min(COLS - 1, nx));
    ny = Math.max(0, Math.min(ROWS - 1, ny));

    for (let i = snake.segments.length - 1; i > 0; i--) {
      snake.segments[i] = { ...snake.segments[i - 1] };
    }
    snake.segments[0] = { x: nx, y: ny };

    // Check trap collision
    if (this.trap && this.activePowerUp?.kind === 'trap') {
      const tx = Math.floor(this.trap.x / CELL_SIZE);
      const ty = Math.floor(this.trap.y / CELL_SIZE);
      if (nx === tx && ny === ty) {
        snake.stunnedMs = 3000;
        this.trap = null;
        this.activePowerUp = null;
      }
    }
  }

  update(_time: number, delta: number): void {
    if (this.roundOver) return;
    this.tongueTimer += delta;

    // Handle active challenge (IQ gate)
    if (this.challengeActive) {
      this.challengeTimerMs += delta;
      const pct = Math.max(0, 100 - (this.challengeTimerMs / this.CHALLENGE_DURATION_MS) * 100);
      const bar = document.getElementById('challenge-timer-bar');
      if (bar) bar.style.width = `${pct.toFixed(1)}%`;
      if (this.challengeTimerMs >= this.CHALLENGE_DURATION_MS) {
        if (this.challengeType === 'hide') {
          this.dismissHideChallenge(false);
        } else {
          this.dismissChallenge(false);
        }
      }
      this.drawScene();
      return;
    }

    this.survivalMs += delta;
    this.spawnAccumMs += delta;

    // Periodic snake spawn (disabled when level uses per-snake behavior configs)
    if (!this.usePerSnakeTick && this.spawnAccumMs >= this.SPAWN_INTERVAL_MS) {
      this.spawnAccumMs = 0;
      this.spawnSnake();
    }

    // Glory invincibility countdown
    if (this.glory.invincibleMs > 0) {
      this.glory.invincibleMs -= delta;
      if (this.glory.invincibleMs < 0) this.glory.invincibleMs = 0;
    }

    // Fall animation countdown — freeze movement while Glory is down
    if (this.gloryFallMs > 0) {
      this.gloryFallMs = Math.max(0, this.gloryFallMs - delta);
      this.drawScene();
      return;   // skip movement and further update logic while knocked down
    }

    // Move Glory with wall collision
    if (gameLevel === 2) {
      // ── Level 2: momentum-based balance movement ──────────────────────
      // Physics constants
      const ACCEL    = 0.28;   // acceleration per frame unit toward input
      const FRICTION = 0.84;   // velocity decay each frame (higher = stops faster, easier turns)
      const MAX_VEL  = 2.4;    // max speed magnitude (px per 16ms frame)

      const rev = LEVEL_CONFIGS[gameLevel - 1].reversedControls ? -1 : 1;
      const baseSpd = Math.min(this.glory.speed, 1.2);
      this.gloryStealthMode = this.shiftKeyDown || this.joystickDist < 39 * 0.45;
      const stealthMult = this.gloryStealthMode ? 0.45 : 1.0;
      const targetSpd = (this.activePowerUp?.kind === 'speed' ? baseSpd * 1.8 : baseSpd * stealthMult);

      const curSpeed = Math.hypot(this.gloryVx, this.gloryVy);

      if (this.joystickActive && this.dragDir) {
        // At high speed, sideways responsiveness is reduced (harder to steer)
        const speedRatio = Math.min(1, curSpeed / MAX_VEL);
        // Control factor: 1.0 at rest → 0.65 at full speed (sloppy but still steerable)
        const controlFactor = 1.0 - speedRatio * 0.35;

        // Decompose input into forward and sideways relative to current velocity
        let accelX = this.dragDir.dx * rev * ACCEL * targetSpd * controlFactor;
        let accelY = this.dragDir.dy * rev * ACCEL * targetSpd * controlFactor;

        this.gloryVx += accelX;
        this.gloryVy += accelY;
      }

      // Apply friction (slide effect when input stops or direction changes)
      this.gloryVx *= FRICTION;
      this.gloryVy *= FRICTION;

      // Clamp to max speed
      const newSpeed = Math.hypot(this.gloryVx, this.gloryVy);
      if (newSpeed > MAX_VEL) {
        this.gloryVx = (this.gloryVx / newSpeed) * MAX_VEL;
        this.gloryVy = (this.gloryVy / newSpeed) * MAX_VEL;
      }

      // Scale velocity by delta for frame-rate independence
      const frameFactor = delta / 16;

      // Apply velocity with wall collision (X and Y separately)
      const newX = this.glory.x + this.gloryVx * frameFactor;
      const nxC  = Math.max(12, Math.min(CANVAS_W - 12, newX));
      const nxCell = Math.max(0, Math.min(COLS - 1, Math.floor(nxC / CELL_SIZE)));
      const cyCell = Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE)));
      if (!this.isWallOrClosedGate(nxCell, cyCell)) {
        this.glory.x = nxC;
      } else {
        this.gloryVx *= -0.2; // bounce off wall, lose most momentum
      }

      const newY = this.glory.y + this.gloryVy * frameFactor;
      const nyC  = Math.max(12, Math.min(CANVAS_H - 12, newY));
      const cxCell = Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE)));
      const nyCell = Math.max(0, Math.min(ROWS - 1, Math.floor(nyC / CELL_SIZE)));
      if (!this.isWallOrClosedGate(cxCell, nyCell)) {
        this.glory.y = nyC;
      } else {
        this.gloryVy *= -0.2;
      }

      if (!this.joystickActive) {
        this.gloryStealthMode = this.shiftKeyDown;
      }
    } else if (this.joystickActive && this.dragDir) {
      // ── All other levels: direct movement ────────────────────────────
      const rev = LEVEL_CONFIGS[gameLevel - 1].reversedControls ? -1 : 1;
      const baseSpd = Math.min(this.glory.speed, 1.2);
      // Stealth: light joystick touch (< 45% of KNOB_MAX=39) OR Shift key held
      this.gloryStealthMode = this.shiftKeyDown || this.joystickDist < 39 * 0.45;
      const stealthMult = this.gloryStealthMode ? 0.4 : 1.0;
      const spd = this.activePowerUp?.kind === 'speed'
        ? baseSpd * 1.8
        : baseSpd * stealthMult;

      // X axis: try movement, block on wall
      const newX = this.glory.x + this.dragDir.dx * spd * rev;
      const newXClamped = Math.max(12, Math.min(CANVAS_W - 12, newX));
      const newXCell = Math.max(0, Math.min(COLS - 1, Math.floor(newXClamped / CELL_SIZE)));
      const curYCell = Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE)));
      if (!this.isWallOrClosedGate(newXCell, curYCell)) {
        this.glory.x = newXClamped;
      }

      // Y axis: try movement, block on wall
      const newY = this.glory.y + this.dragDir.dy * spd * rev;
      const newYClamped = Math.max(12, Math.min(CANVAS_H - 12, newY));
      const curXCell = Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE)));
      const newYCell = Math.max(0, Math.min(ROWS - 1, Math.floor(newYClamped / CELL_SIZE)));
      if (!this.isWallOrClosedGate(curXCell, newYCell)) {
        this.glory.y = newYClamped;
      }
    } else {
      // Standing still — stealth only if Shift is held
      this.gloryStealthMode = this.shiftKeyDown;
    }

    // Smooth facing — interpolate facingAngle toward drag/trail direction
    {
      const TURN_SPEED_ACTIVE = 5.5;  // rad/s while steering
      const TURN_SPEED_IDLE   = 3.0;  // rad/s when coasting (aligns with trail)
      let targetAngle: number | null = null;

      if (this.joystickActive && this.dragDir) {
        targetAngle = Math.atan2(this.dragDir.dy, this.dragDir.dx);
      } else {
        // Align facing with movement trail when not actively steering
        const tr = this.gloryTrail;
        if (tr.length >= 2) {
          const tdx = tr[0].x - tr[1].x;
          const tdy = tr[0].y - tr[1].y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen > 1) targetAngle = Math.atan2(tdy / tlen, tdx / tlen);
        }
      }

      if (targetAngle !== null) {
        let diff = targetAngle - this.facingAngle;
        // Normalise to shortest arc [-π, π]
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const speed = this.joystickActive ? TURN_SPEED_ACTIVE : TURN_SPEED_IDLE;
        const maxTurn = speed * delta / 1000;
        this.facingAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
      }
    }

    // Wind effect (Level 9)
    if (LEVEL_CONFIGS[gameLevel - 1].windEffect) {
      const windAngle = (this.exitPulseTimer * 0.04) % (Math.PI * 2);
      const drift = 0.25;
      this.glory.x = Math.max(0, Math.min(CANVAS_W, this.glory.x + Math.cos(windAngle) * drift));
      this.glory.y = Math.max(0, Math.min(CANVAS_H, this.glory.y + Math.sin(windAngle) * drift));
    }

    // Update bush-hide state and glory trail
    const gloryCol = Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE)));
    const gloryRow = Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE)));
    this.hiddenInBush = this.bushCells.has(`${gloryCol},${gloryRow}`);

    // Track entering/leaving a bush cell
    const currentBushKey = this.hiddenInBush ? `${gloryCol},${gloryRow}` : null;
    if (currentBushKey !== this.lastBushKey) {
      if (currentBushKey === null) {
        // Left the bush — reset hiding state
        this.hidingSuccess = false;
        this.bushChallengeAnswered = false;
      }
      this.lastBushKey = currentBushKey;
    }

    // Penalty countdown after a failed hide challenge (snakes stay alert)
    if (this.hidingSearchMs > 0) {
      this.hidingSearchMs = Math.max(0, this.hidingSearchMs - delta);
    }

    // Check-sign animation countdown
    if (this.hideSuccessTimerMs > 0) {
      this.hideSuccessTimerMs = Math.max(0, this.hideSuccessTimerMs - delta);
    }

    // Start gate: open when Glory walks past col 1 (original Mountain Path gate — skip for house layout)
    if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout && !this.gateOpen) {
      const gc1 = this.gloryCell();
      if (gc1.x >= 1) {
        this.gateOpen = true;
        this.gateOpenAnimMs = 0;
      }
    }
    if (this.gateOpenAnimMs < 800) this.gateOpenAnimMs += delta;
    if (this.exitGateOpenAnimMs >= 0 && this.exitGateOpenAnimMs < 800) this.exitGateOpenAnimMs += delta;

    // Bush hiding — always succeeds, no trivia challenge
    if (this.hiddenInBush && !this.bushChallengeAnswered
        && this.bushCells.size > 0 && gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) {
      this.hidingSuccess = true;
      this.bushChallengeAnswered = true;
    }

    this.gloryTrail.unshift({ x: this.glory.x, y: this.glory.y });
    if (this.gloryTrail.length > this.gloryTrailMax) this.gloryTrail.pop();

    // Per-snake tick accumulator (levels with snakeEnemyConfigs)
    if (this.usePerSnakeTick) {
      const gc3 = this.gloryCell();
      // Level 2 stall penalty: snakes move 40% faster when Glory isn't advancing
      const stallMult = (gameLevel === 2 && this.stallBoostMs > 0) ? 1.4 : 1.0;
      for (const snake of this.snakes) {
        if (!snake.alive || snake.stunnedMs > 0) continue;
        snake.tickAccumMs += delta * stallMult;
        while (snake.tickAccumMs >= snake.tickMs) {
          snake.tickAccumMs -= snake.tickMs;
          this.moveSnakeStep(snake, gc3);
        }
        // Advance lerp progress toward 1 (next step)
        snake.lerpT = Math.min(1, snake.tickAccumMs / snake.tickMs);
      }
    }

    // Advance lerp on global-timer snakes (non-usePerSnakeTick)
    if (!this.usePerSnakeTick) {
      for (const snake of this.snakes) {
        if (!snake.alive) continue;
        snake.lerpT = Math.min(1, snake.lerpT + delta / snake.tickMs);
      }
    }

    // Collision check
    if (this.glory.invincibleMs <= 0) {
      this.checkCollision();
    }

    // Poison damage
    if (this.glory.invincibleMs <= 0) {
      const gc = this.gloryCell();
      if (this.poisonTiles.has(`${gc.x},${gc.y}`)) {
        this.poisonContactMs += delta;
        if (this.poisonContactMs >= 3000) {
          this.poisonContactMs = 0;
          this.loseLife();
        }
      } else {
        this.poisonContactMs = 0;
      }
    }

    // IQ gate check — proximity-based so walls don't block the trigger
    if (!this.challengeActive) {
      const gc = this.gloryCell();
      for (const gate of this.iqGates) {
        if (!gate.open && Math.abs(gc.x - gate.col) + Math.abs(gc.y - gate.row) <= 1) {
          this.triggerIQGateChallenge(gate);
          break;
        }
      }
    }

    // (Fruit puzzle and IQ gate locks removed — exit is always open)

    // House key pickup — glowing key in SE room bypasses the puzzle entirely
    if (this.houseKey && !this.houseKey.taken && !this.exitPuzzleSolved) {
      const gcK = this.gloryCell();
      if (gcK.x === this.houseKey.col && gcK.y === this.houseKey.row) {
        this.houseKey.taken = true;
        this.score += 25;
        this.unlockExit();
      }
    }

    // Escape rush timer — counts up after exit unlocks so visual effects can animate
    if (this.escapeRushActive) {
      this.escapeRushMs += delta;
    }

    // Snake berserk penalty countdown (triggered by wrong fruit-puzzle answer)
    if (this.snakePenaltyMs > 0) {
      const prevMs = this.snakePenaltyMs;
      this.snakePenaltyMs = Math.max(0, this.snakePenaltyMs - delta);
      if (this.snakePenaltyMs === 0 && prevMs > 0) {
        // Restore snake speeds to normal apple-scaled levels
        for (const sn of this.snakes) {
          if (!sn.alive || sn.behavior === 'slow') continue;
          const isHunter = sn.behavior === 'hunter';
          const ramp = isHunter ? 0.18 : 0.08;
          const maxFactor = isHunter ? 2.5 : 1.8;
          const factor = Math.min(maxFactor, 1.0 + this.applesCollected * ramp);
          sn.tickMs = Math.max(isHunter ? 100 : 150, Math.floor(sn.baseTick / factor));
        }
      }
    }

    // Power-up timer
    if (this.activePowerUp && this.activePowerUp.kind !== 'trap') {
      this.activePowerUp.msRemaining -= delta;
      if (this.activePowerUp.msRemaining <= 0) this.activePowerUp = null;
    }

    // Berry invisibility countdown
    if (this.berryInvisibleMs > 0) {
      this.berryInvisibleMs = Math.max(0, this.berryInvisibleMs - delta);
    }

    // Smoke bomb countdown
    if (this.smokeActiveMs > 0) {
      this.smokeActiveMs = Math.max(0, this.smokeActiveMs - delta);
    }

    // Stick swing visual countdown
    if (this.stickSwingMs > 0) {
      this.stickSwingMs = Math.max(0, this.stickSwingMs - delta);
    }

    // Jump scare flash countdown
    if (this.jumpScareFlashMs > 0) {
      this.jumpScareFlashMs = Math.max(0, this.jumpScareFlashMs - delta);
    }

    // ── Audio ticks (house layout + Level 2) ─────────────────────────────
    if (LEVEL_CONFIGS[gameLevel - 1].houseLayout || gameLevel === 2) {
      // Hiss: play when nearest active snake is within 5 cells
      this.snakeHissTimerMs = Math.max(0, this.snakeHissTimerMs - delta);
      if (this.snakeHissTimerMs === 0) {
        const gcA = this.gloryCell();
        let nearestDist = Infinity;
        for (const sn of this.snakes) {
          if (!sn.alive || (!sn.emerged && !sn.awake)) continue;
          const dist = Math.hypot(sn.segments[0].x - gcA.x, sn.segments[0].y - gcA.y);
          if (dist < nearestDist) nearestDist = dist;
        }
        if (nearestDist <= 5) {
          const vol = 1 - (nearestDist / 5); // louder when closer
          this.playHiss(vol);
          this.snakeHissTimerMs = this.escapeRushActive ? 1200 : 2200;
        } else {
          this.snakeHissTimerMs = 800; // check again soon
        }
      }

      // Footsteps: soft click while moving (dirt sound on Level 2)
      this.footstepTimerMs = Math.max(0, this.footstepTimerMs - delta);
      if (this.footstepTimerMs === 0 && this.joystickActive) {
        this.playFootstep();
        this.footstepTimerMs = gameLevel === 2 ? 320 : 380;
      }
    }

    // ── Heartbeat — any level at 1 life remaining ─────────────────────────
    if (this.glory.lives === 1) {
      this.heartbeatTimerMs = Math.max(0, this.heartbeatTimerMs - delta);
      if (this.heartbeatTimerMs === 0) {
        this.playHeartbeat();
        this.heartbeatTimerMs = 860;
      }
    }

    // Level 2: animate fog + wind particles + periodic wind sound
    if (gameLevel === 2) {
      this.fogScrollMs += delta;
      for (const p of this.windParticles) {
        p.x += p.speed * delta * 0.05;
        if (p.x > CANVAS_W + 5) {
          p.x = -5;
          p.y = 90 + Math.random() * 340;
          p.alpha = 0.07 + Math.random() * 0.25;
        }
      }
      this.windTimerMs = Math.max(0, this.windTimerMs - delta);
      if (this.windTimerMs === 0) {
        this.playWind();
        this.windTimerMs = 3500 + Math.random() * 2500;
      }

      // ── Falling rocks: spawn in cliff-face zones, fall into abyss ────
      this.rockSpawnTimer = Math.max(0, this.rockSpawnTimer - delta);
      if (this.rockSpawnTimer === 0) {
        // Spawn in one of the three cliff zones (not on the trail)
        const zone = Math.floor(Math.random() * 3);
        let rx: number;
        if      (zone === 0) rx = 10  + Math.random() * 200;   // left cliff
        else if (zone === 1) rx = 330 + Math.random() * 40;    // centre gap
        else                 rx = 470 + Math.random() * 160;   // right cliff
        this.fallingRocks.push({
          x: rx, y: 145 + Math.random() * 100,
          vy: 1.2 + Math.random() * 1.4,
          size: 3 + Math.random() * 5,
          alpha: 0.55 + Math.random() * 0.35,
        });
        this.playRockFall();
        this.rockSpawnTimer = 3500 + Math.random() * 4500;
      }
      // Animate rocks
      for (const r of this.fallingRocks) {
        r.y  += r.vy * delta * 0.06;
        r.vy += 0.015 * delta * 0.06;  // gravity
        r.alpha -= 0.0004 * delta;
      }
      // Remove rocks that have fallen off screen
      for (let i = this.fallingRocks.length - 1; i >= 0; i--) {
        if (this.fallingRocks[i].y > CANVAS_H + 10 || this.fallingRocks[i].alpha <= 0) {
          this.fallingRocks.splice(i, 1);
        }
      }

      // ── Wind gust: pushes Glory — stronger in exposed connector zones ──
      this.windGustTimer = Math.max(0, this.windGustTimer - delta);
      if (this.windGustTimer === 0) {
        this.windGustDir    = Math.random() < 0.65 ? 1 : -1; // mostly rightward
        this.windGustActive = 800 + Math.random() * 600;
        this.windGustTimer  = 4000 + Math.random() * 3500;
        this.cameras.main.shake(120, 0.004); // gust hit — quick jolt
      }
      if (this.windGustActive > 0) {
        this.windGustActive -= delta;
        // Zone-aware intensity: connector areas get 2× wind force
        const inStrongZone = VenomArenaScene.WIND_STRONG_X_RANGES.some(
          ([x0, x1]) => this.glory.x >= x0 && this.glory.x <= x1
        );
        const driftStrength = inStrongZone ? 1.5 : 0.7;
        const drift = this.windGustDir * driftStrength * (delta / 16);
        const wxNew = Math.max(12, Math.min(CANVAS_W - 12, this.glory.x + drift));
        const wxCell  = Math.floor(wxNew / CELL_SIZE);
        const wyCell  = Math.floor(this.glory.y / CELL_SIZE);
        if (!this.isWallOrClosedGate(wxCell, wyCell)) {
          this.glory.x = wxNew;
        }
      }

      // ── Constant chase: respawn retreating/stuck hunters behind Glory ──
      for (const sn of this.snakes) {
        if (sn.behavior !== 'hunter') continue;
        // If hunter has retreated all the way back to spawn (col ≤ 1) re-energise it
        if (sn.retreating && sn.segments[0].x <= 1) {
          sn.retreating = false;
          sn.stunnedMs  = 0;
          // Teleport to left edge, same row as Glory so it chases immediately
          const glRow = this.gloryCell().y;
          const spawnRow = Math.abs(glRow - 5) < Math.abs(glRow - 6) ? 5 : 6;
          sn.segments.forEach(p => { p.x = 0; p.y = spawnRow; });
        }
      }
      // Tick respawn queue (for any hunters queued from other sources)
      for (let i = this.hunterRespawnQueue.length - 1; i >= 0; i--) {
        this.hunterRespawnQueue[i].timerMs -= delta;
        if (this.hunterRespawnQueue[i].timerMs <= 0) {
          this.spawnSnake(false, this.hunterRespawnQueue[i].cfg);
          this.hunterRespawnQueue.splice(i, 1);
        }
      }

      // ── Edge-danger ledge tiles: standing on a precarious edge → fall ─
      const gc2 = this.gloryCell();
      const onEdge = VenomArenaScene.EDGE_DANGER_CELLS.some(
        ([c, r]) => c === gc2.x && r === gc2.y
      );
      if (onEdge && this.glory.invincibleMs <= 0) {
        const wasOff = this.edgeDangerMs === 0;
        this.edgeDangerMs += delta;
        this.edgeDangerWarn = true;
        if (wasOff) {
          // First step on crumbling edge — quick crack warning
          this.overlayText.setText('⚠️ CRUMBLING EDGE!\nMove away!');
          this.overlayText.setVisible(true);
          this.time.delayedCall(900, () => { if (!this.roundOver) this.overlayText.setVisible(false); });
        }
        if (this.edgeDangerMs >= 1400) {
          // Fell off the ledge
          this.edgeDangerMs = 0;
          this.loseLife();
        }
      } else {
        this.edgeDangerMs = Math.max(0, this.edgeDangerMs - delta * 2); // recover quickly
        if (this.edgeDangerMs === 0) this.edgeDangerWarn = false;
      }

      // ── Forward pressure: stalling lets snakes close in faster ────────
      if (!this.roundOver) {
        const movedForward = this.glory.x - this.lastForwardX;
        if (movedForward > 8) {
          // Made progress — reset stall
          this.lastForwardX  = this.glory.x;
          this.stallTimerMs  = 0;
        } else {
          this.stallTimerMs += delta;
          if (this.stallTimerMs >= 2500 && this.stallBoostMs <= 0) {
            // Snakes surge forward for 3 seconds
            this.stallBoostMs   = 3000;
            this.stallWarningMs = 2500;
            this.stallTimerMs   = 0;
            this.lastForwardX   = this.glory.x;
            // Flash warning text
            this.overlayText.setText('⚠️ KEEP MOVING!\n🐍 They\'re getting closer!');
            this.overlayText.setVisible(true);
            this.time.delayedCall(1800, () => { if (!this.roundOver) this.overlayText.setVisible(false); });
          }
        }
        if (this.stallBoostMs > 0) {
          this.stallBoostMs = Math.max(0, this.stallBoostMs - delta);
        }
        if (this.stallWarningMs > 0) {
          this.stallWarningMs = Math.max(0, this.stallWarningMs - delta);
        }
      }
    }

    // ── Unstable path + collapsed cell damage (shared by L2 & L3) ─────────────
    if ((gameLevel === 2 || gameLevel === 3) && !this.roundOver) {
      // Crack → collapse → recover cycle
      for (const uc of this.unstableCells) {
        uc.timerMs = Math.max(0, uc.timerMs - delta);
        if (uc.timerMs > 0) continue;
        const key = `${uc.col},${uc.row}`;
        switch (uc.phase) {
          case 'stable':
            uc.phase   = 'cracking';
            uc.timerMs = 1800; // crack warning duration
            this.playCrack();
            this.cameras.main.shake(180, 0.004); // subtle pre-crack tremor
            break;
          case 'cracking':
            uc.phase   = 'collapsed';
            uc.timerMs = 3500; // how long the pit stays open
            this.collapsedCells.add(key);
            this.cameras.main.shake(320, 0.009); // heavy collapse thud
            break;
          case 'collapsed':
            uc.phase   = 'recovering';
            uc.timerMs = 1200;
            this.collapsedCells.delete(key);
            break;
          case 'recovering':
            uc.phase   = 'stable';
            uc.timerMs = 7000 + Math.random() * 6000; // wait before cracking again
            break;
        }
      }
      // Collapsed cell damage: Glory takes a hit if she steps into a pit
      if (this.glory.invincibleMs <= 0) {
        const gc = this.gloryCell();
        if (this.collapsedCells.has(`${gc.x},${gc.y}`)) {
          this.loseLife();
          // Push Glory one step back (away from the pit) so she isn't stuck in it
          this.gloryVx = -this.gloryVx * 0.5;
          this.gloryVy = -this.gloryVy * 0.5;
        }
      }
    }

    // ── Level 3: Bamboo Bridge Maze mechanics ─────────────────────────────────
    if (gameLevel === 3 && !this.roundOver) {
      this.fogScrollMs += delta;
      // Ambient creak sounds
      this.bridgeCreakTimerMs -= delta;
      if (this.bridgeCreakTimerMs <= 0) {
        this.bridgeCreakTimerMs = 2500 + Math.random() * 3000;
        this.playBridgeCreak();
      }
      // Whisper: random soft hiss when Glory hasn't moved
      const gloryMoving = Math.hypot(this.glory.x - this.lastForwardX, 0) > 2;
      if (!gloryMoving) {
        this.level3StillMs += delta;
        if (this.level3StillMs > 1800 && Math.random() < 0.004) {
          this.playWhisper();
          this.level3StillMs = 0;
        }
      } else {
        this.level3StillMs = 0;
      }
      // Berry path-glow countdown
      if (this.pathGlowMs > 0) this.pathGlowMs -= delta;
    }

    // Snake stun countdown
    for (const snake of this.snakes) {
      if (snake.stunnedMs > 0) {
        snake.stunnedMs = Math.max(0, snake.stunnedMs - delta);
      }
    }

    // Susie cooldown
    if (!this.susieOfferActive && this.susieCooldownMs > 0) {
      this.susieCooldownMs -= delta;
      if (this.susieCooldownMs <= 0 && !this.roundOver) {
        this.offerSusiePowerUp();
      }
    }

    // Moving walls update
    for (const mw of this.movingWalls) {
      mw.timer += delta;
      if (mw.timer >= mw.interval) {
        mw.timer = 0;
        this.walls.delete(`${mw.col},${mw.row}`);
        const tmpCol = mw.col; const tmpRow = mw.row;
        mw.col = mw.col2; mw.row = mw.row2;
        mw.col2 = tmpCol; mw.row2 = tmpRow;
        this.walls.add(`${mw.col},${mw.row}`);
      }
    }

    // Speed ramp
    const config = LEVEL_CONFIGS[gameLevel - 1];
    if (config.speedRamp) {
      this.speedRampTimer += delta;
      if (this.speedRampTimer >= 15000 && this.speedRampFactor < 2.5) {
        this.speedRampTimer = 0;
        this.speedRampFactor = Math.min(2.5, this.speedRampFactor + 0.25);
        const newTickMs = Math.max(80, Math.floor(config.snakeTickMs / this.speedRampFactor));
        this.startSnakeTimer(newTickMs);
      }
    }

    // Exit pulse animation
    this.exitPulseTimer += delta;

    // Collect items Glory walks over
    const gc2 = this.gloryCell();
    for (const c of this.collectibles) {
      if (!c.collected && c.col === gc2.x && c.row === gc2.y) {
        c.collected = true;
        this.score += 10;
        this.gloryTrailMax = Math.min(24, this.gloryTrailMax + 3);

        // Fruit-type effects
        if (c.kind === 'apple') {
          // 🍎 Apple → restore 1 life (up to configured max)
          this.glory.lives = Math.min(config.lives, this.glory.lives + 1);
        } else if (c.kind === 'banana') {
          // 🍌 Banana → 3-second speed boost
          this.activePowerUp = { kind: 'speed', msRemaining: 3000 };
        } else if (c.kind === 'berry') {
          // 🍓 Berry → 4-second invisibility (snakes lose track of Glory)
          this.berryInvisibleMs = 4000;
          if (gameLevel === 3) { this.pathGlowMs = 3000; }
        }

        // Level 1 (house): track fruit count + progressively speed up snakes
        if (gameLevel === 1) {
          this.applesCollected++;
          // First apple of a new cycle — clear hidden state (snakes are on the hunt again)
          if (this.applesCollected === 1) {
            this.hidingSuccess = false;
          }
          // Each apple scales snake speed — hunters scale twice as fast, slow snakes don't scale
          for (const sn of this.snakes) {
            if (!sn.alive) continue;
            if (sn.behavior === 'slow') continue;        // slow snakes are always slow
            const isHunter = sn.behavior === 'hunter';
            const ramp = isHunter ? 0.18 : 0.08;        // hunters: +18%/apple, others: +8%
            const maxFactor = isHunter ? 2.5 : 1.8;
            const factor = Math.min(maxFactor, 1.0 + this.applesCollected * ramp);
            sn.tickMs = Math.max(isHunter ? 100 : 150, Math.floor(sn.baseTick / factor));
          }
        }
      }
    }

    // Pistol pickups
    for (const p of this.pistolPickups) {
      if (!p.taken && gc2.x === p.col && gc2.y === p.row) {
        p.taken = true;
        this.pistolBullets = Math.min(6, this.pistolBullets + 3);
        this.updatePistolHUD();
      }
    }

    // Advance bullet animations
    for (const b of this.bullets) {
      if (b.done) continue;
      b.progress += delta / 140;  // ~140ms travel time
      if (b.progress >= 1) {
        b.done = true;
        const target = this.snakes.find(s => s.id === b.targetId);
        if (target && target.alive) target.stunnedMs = 2500;
      }
    }
    this.bullets = this.bullets.filter(b => b.progress < 1.8);

    // Exit zone check — reach exit to win
    if (this.exitZone && gc2.x === this.exitZone.col && gc2.y === this.exitZone.row) {
      if (gameLevel === 2) {
        this.triggerLevel2Ending();
      } else {
        this.winGame();
      }
      return;
    }

    // Check win (survival timer — skip if level uses exit zone)
    const goal = config.survivalGoal;
    if (!this.exitZone && this.survivalMs >= goal * 1000) {
      this.winGame();
      return;
    }

    this.score = Math.floor((this.survivalMs / 1000) * config.scoreMultiplier);

    this.updateDOM();
    this.drawScene();
  }

  private checkCollision(): void {
    // Snakes can't find Glory when she is successfully hidden, smoke-shrouded, or berry-invisible
    if (this.hiddenInBush && this.hidingSuccess) return;
    if (this.berryInvisibleMs > 0) return;
    if (this.smokeActiveMs > 0) return;
    const gc = this.gloryCell();
    for (const snake of this.snakes) {
      if (!snake.alive || snake.stunnedMs > 0) continue;
      if (!snake.emerged || snake.retreating) continue;   // still in bush or going back
      const head = snake.segments[0];
      if (head.x === gc.x && head.y === gc.y) {
        this.loseLife();
        return;
      }
    }
  }

  private loseLife(): void {
    this.glory.lives -= 1;
    this.glory.invincibleMs = 2000;
    this.gloryFallMs = 1200;   // trigger lying-down animation
    if (this.glory.lives <= 0) {
      this.glory.lives = 0;
      this.updateDOM();
      this.gameOver();
    }
  }

  // ── IQ Gate challenge ──────────────────────────────────────────────────────
  private triggerIQGateChallenge(gate: { col: number; row: number; open: boolean; challenge: Challenge }): void {
    this.challengeActive = true;
    this.pendingIQGate = gate;
    this.challengeTimerMs = 0;
    this.snakeTickTimer?.remove();

    const overlay = document.getElementById('challenge-overlay');
    const badge = overlay?.querySelector('.challenge-badge');
    const hint = overlay?.querySelector('.challenge-hint');
    const qEl = document.getElementById('challenge-question');
    const choicesEl = document.getElementById('challenge-choices');
    const bar = document.getElementById('challenge-timer-bar');

    if (badge) badge.textContent = '🔐 IQ Gate';
    if (hint) hint.textContent = `Answer correctly to open the gate — ${this.CHALLENGE_DURATION_MS / 1000}s!`;
    this.challengeType = 'iqgate';
    if (qEl) qEl.textContent = gate.challenge.q;
    if (bar) bar.style.width = '100%';

    if (choicesEl) {
      choicesEl.innerHTML = '';
      gate.challenge.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.className = 'challenge-choice-btn';
        btn.textContent = choice;
        btn.addEventListener('click', () => { this.answerChallenge(idx); });
        choicesEl.appendChild(btn);
      });
    }

    overlay?.classList.remove('hidden');
  }

  private dismissHideChallenge(correct: boolean): void {
    if (correct) {
      this.hidingSuccess = true;
      this.hideSuccessTimerMs = 3000;   // show ✓ check sign for 3 s
      // All emerged snakes retreat back to their spawn bushes
      for (const snake of this.snakes) {
        if (snake.alive && snake.emerged && !snake.retreating) {
          snake.retreating = true;
        }
      }
      // Reset apple count — snakes will stay hidden until Glory eats the next apple
      if (gameLevel === 1) this.applesCollected = 0;
    } else {
      this.hidingSuccess = false;
      // Penalty: snakes are agitated for ~4.5 s
      this.hidingSearchMs = this.HIDING_DURATION_MS;
      this.glory.invincibleMs = Math.max(this.glory.invincibleMs, 600);
    }

    this.challengeActive = false;
    this.challengeTimerMs = 0;
    this.challengeType = null;

    document.getElementById('challenge-overlay')?.classList.add('hidden');

    if (!this.roundOver) {
      const config = LEVEL_CONFIGS[gameLevel - 1];
      const tickMs = Math.max(80, Math.floor(config.snakeTickMs / this.speedRampFactor));
      this.startSnakeTimer(tickMs);
    }
  }

  // ── Unlock exit + trigger escape rush ─────────────────────────────────────
  private unlockExit(): void {
    // Remove the exit blocker walls
    this.walls.delete('25,9');
    this.walls.delete('25,10');
    this.walls.delete('25,11');
    this.exitPuzzleSolved = true;
    this.exitGateOpenAnimMs = 0;
    this.playExitOpen();

    // Escape rush: all snakes wake up and charge Glory at full speed
    this.escapeRushActive = true;
    this.escapeRushMs = 0;
    this.glory.invincibleMs = Math.max(this.glory.invincibleMs, 2000); // 2-second head start

    for (const sn of this.snakes) {
      if (!sn.alive) continue;
      sn.behavior = 'hunter';
      sn.emerged = true;
      sn.retreating = false;
      sn.stunnedMs = 0;
      sn.tickMs = 160;          // fast but not impossible
      sn.tickAccumMs = 0;
    }

    // "RUN!" banner
    this.overlayText.setText('✨ EXIT OPEN!\n🐍 Snakes are coming — RUN! 🏃‍♀️');
    this.overlayText.setVisible(true);
    this.time.delayedCall(2500, () => { if (!this.roundOver) this.overlayText.setVisible(false); });
  }

  private answerChallenge(idx: number): void {
    if (!this.challengeActive || !this.pendingIQGate) return;
    const correct = idx === this.pendingIQGate.challenge.answer;
    this.dismissChallenge(correct);
  }

  private dismissChallenge(correct: boolean): void {
    if (this.pendingIQGate) {
      if (correct) {
        this.pendingIQGate.open = true;
        this.walls.delete(`${this.pendingIQGate.col},${this.pendingIQGate.row}`);
        if (gameLevel === 1) this.exitGateOpenAnimMs = 0;   // start exit gate swing animation
      } else {
        // Flash Glory red briefly
        this.glory.invincibleMs = Math.max(this.glory.invincibleMs, 500);
      }
    }

    this.challengeActive = false;
    this.pendingIQGate = null;
    this.challengeTimerMs = 0;

    document.getElementById('challenge-overlay')?.classList.add('hidden');

    if (!this.roundOver) {
      const config = LEVEL_CONFIGS[gameLevel - 1];
      const tickMs = Math.max(80, Math.floor(config.snakeTickMs / this.speedRampFactor));
      this.startSnakeTimer(tickMs);
    }
  }

  // ── Susie helper ───────────────────────────────────────────────────────────
  private POWER_UP_ROTATION: PowerUpKind[] = ['flashlight', 'trap', 'speed', 'hint'];
  private readonly POWER_UP_LABELS: Record<PowerUpKind, string> = {
    flashlight: '🔦 Flashlight',
    trap: '🪤 Trap',
    speed: '⚡ Speed Boost',
    hint: '💡 Hint',
    pistol: '🔫 Pistol',
    stick: '🪵 Wood Stick',
    smoke: '💨 Smoke Bomb',
  };

  private offerSusiePowerUp(): void {
    this.susieOfferActive = true;
    this.currentPowerUpOffer = this.POWER_UP_ROTATION[this.powerUpIndex % this.POWER_UP_ROTATION.length];
    this.powerUpIndex += 1;

    const bubble = document.getElementById('susie-bubble');
    const btn    = document.getElementById('susie-powerup-btn');
    if (bubble && btn) {
      btn.textContent = this.POWER_UP_LABELS[this.currentPowerUpOffer];
      bubble.classList.remove('hidden');
    }

    if (this.powerUpOfferTimeout) clearTimeout(this.powerUpOfferTimeout);
    this.powerUpOfferTimeout = setTimeout(() => this.dismissSusieOffer(), 10000);
  }

  private dismissSusieOffer(): void {
    this.susieOfferActive = false;
    this.susieCooldownMs = 20000;
    document.getElementById('susie-bubble')?.classList.add('hidden');
    if (this.powerUpOfferTimeout) {
      clearTimeout(this.powerUpOfferTimeout);
      this.powerUpOfferTimeout = null;
    }
  }

  private activatePowerUp(kind: PowerUpKind): void {
    this.dismissSusieOffer();
    if (kind === 'trap') {
      this.waitingForTrapPlacement = true;
      this.activePowerUp = null;
    } else if (kind === 'stick') {
      this.useWoodStick();
    } else if (kind === 'smoke') {
      this.smokeActiveMs = 5000;
    } else {
      const durations: Record<PowerUpKind, number> = { flashlight: 8000, trap: 0, speed: 6000, hint: 4000, pistol: 0, stick: 0, smoke: 0 };
      this.activePowerUp = { kind, msRemaining: durations[kind] };
    }
  }

  // ── Audio engine (Web Audio API — all sounds generated procedurally) ───────
  private getAudioCtx(): AudioContext | null {
    if (!this.audioCtx) {
      try { this.audioCtx = new AudioContext(); } catch { return null; }
    }
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    return this.audioCtx;
  }

  /** Bandpass-filtered white noise — snake nearby hiss */
  private playHiss(volume: number): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 0.3), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();  src.buffer = buf;
    const bp = ctx.createBiquadFilter();   bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 0.7;
    const g = ctx.createGain();            g.gain.value = Math.min(1, volume) * 0.35;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start();
  }

  /** Soft low-frequency click — sneaking footstep */
  private playFootstep(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.floor(sr * 0.045), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const src = ctx.createBufferSource();  src.buffer = buf;
    const lp = ctx.createBiquadFilter();   lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain();            g.gain.value = 0.12;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start();
  }

  /** Descending stab + brief thud — sleeper wakes / jump scare */
  private playJumpScare(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.4);
  }

  /** Ascending 3-note chime — exit unlock */
  private playExitOpen(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    [440, 554, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.35);
    });
  }

  // ── Level 3 bridge creak (sawtooth wobble) ────────────────────────────────
  private playBridgeCreak(): void {
    try {
      const ctx = new AudioContext();
      // Creak = slow frequency wobble + noise burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180 + Math.random() * 60, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120 + Math.random() * 40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
      ctx.close();
    } catch { /* silent */ }
  }

  // ── Level 3 whisper (bandpass noise) ─────────────────────────────────────
  private playWhisper(): void {
    try {
      const ctx = new AudioContext();
      const bufSize = ctx.sampleRate * 0.8;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.015;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filter.type = 'bandpass'; filter.frequency.value = 2200; filter.Q.value = 0.8;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      src.buffer = buf;
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime);
      ctx.close();
    } catch { /* silent */ }
  }

  // ── Level 2 wind howl (procedural noise burst) ───────────────────────────
  private playWind(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const dur    = 1.4;
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp  = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.45;
    const lp  = ctx.createBiquadFilter();
    lp.type = 'lowpass';  lp.frequency.value = 620; lp.Q.value = 0.3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 0.35);
    gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.70);
    gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 1.05);
    gain.gain.linearRampToValueAtTime(0,    ctx.currentTime + dur);
    src.connect(bp); bp.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + dur);
  }

  private playHeartbeat(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    // Lub-DUB: two sine thumps (60 Hz body, 48 Hz resonance)
    const playThump = (delay: number, freq: number, vol: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol,  ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    };
    playThump(0.00, 60, 0.28); // lub
    playThump(0.08, 48, 0.18); // (overtone)
    playThump(0.28, 60, 0.38); // DUB (louder)
    playThump(0.32, 48, 0.22);
  }

  private playRockFall(): void {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    // Two quick noise bursts with descending frequency — scraping rock
    for (let b = 0; b < 2; b++) {
      const dur    = 0.18 + b * 0.09;
      const bufLen = Math.floor(ctx.sampleRate * dur);
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
      const src  = ctx.createBufferSource(); src.buffer = buf;
      const hp   = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900 - b * 300;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.11 - b * 0.03, ctx.currentTime + b * 0.14);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + b * 0.14 + dur);
      src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime + b * 0.14);
      src.stop (ctx.currentTime + b * 0.14 + dur);
    }
  }

  private playCrack(): void {
    // Deep structural groan — like ground giving way
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
    // Add a short noise burst for the crack texture
    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf  = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src2  = ctx.createBufferSource(); src2.buffer = buf;
    const gain2 = ctx.createGain(); gain2.gain.value = 0.14;
    src2.connect(gain2); gain2.connect(ctx.destination);
    src2.start(); src2.stop(ctx.currentTime + 0.15);
  }
  private useWoodStick(): void {
    // Find the nearest emerged, non-retreating snake within 8 cells
    const gc = this.gloryCell();
    let nearest: SnakeEnemy | null = null;
    let minDist = Infinity;
    for (const sn of this.snakes) {
      if (!sn.alive || !sn.emerged || sn.retreating) continue;
      const dist = Math.hypot(sn.segments[0].x - gc.x, sn.segments[0].y - gc.y);
      if (dist < 8 && dist < minDist) { minDist = dist; nearest = sn; }
    }

    if (!nearest) return;  // no snake in range — tool wasted

    nearest.stunnedMs = Math.max(nearest.stunnedMs, 4000);  // stun 4 seconds
    nearest.retreating = true;                               // force it back to spawn
    this.stickSwingMs = 500;                                 // brief visual flash
    this.score += 5;
  }

  // ── Pistol ─────────────────────────────────────────────────────────────────
  private firePistol(): void {
    if (this.pistolBullets <= 0 || this.roundOver) return;

    // Find nearest emerged, non-retreating snake
    let nearest: SnakeEnemy | null = null;
    let minDist = Infinity;
    for (const sn of this.snakes) {
      if (!sn.alive || !sn.emerged || sn.retreating || sn.stunnedMs > 0) continue;
      const hx = sn.segments[0].x * CELL_SIZE + CELL_SIZE / 2;
      const hy = sn.segments[0].y * CELL_SIZE + CELL_SIZE / 2;
      const d = Math.hypot(hx - this.glory.x, hy - this.glory.y);
      if (d < minDist) { minDist = d; nearest = sn; }
    }

    if (!nearest) return;   // no valid target

    this.pistolBullets--;
    this.updatePistolHUD();

    const tx = nearest.segments[0].x * CELL_SIZE + CELL_SIZE / 2;
    const ty = nearest.segments[0].y * CELL_SIZE + CELL_SIZE / 2;
    this.bullets.push({ x: this.glory.x, y: this.glory.y, tx, ty, progress: 0, done: false, targetId: nearest.id });
  }

  private updatePistolHUD(): void {
    const btn = document.getElementById('pistol-btn');
    const cnt = document.getElementById('pistol-count');
    if (!btn || !cnt) return;
    if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) {
      btn.classList.remove('hidden');
      cnt.textContent = String(this.pistolBullets);
      btn.classList.toggle('empty', this.pistolBullets <= 0);
    } else {
      btn.classList.add('hidden');
    }
  }

  // ── DOM ────────────────────────────────────────────────────────────────────
  private updateDOM(): void {
    const livesEl = document.getElementById('lives-display');
    if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, this.glory.lives));

    const timerEl = document.getElementById('survival-timer');
    if (timerEl) {
      const secs = Math.floor(this.survivalMs / 1000);
      timerEl.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    }

    const scoreEl = document.getElementById('glory-score-display');
    if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;

    const stealthEl = document.getElementById('stealth-indicator');
    if (stealthEl) stealthEl.classList.toggle('hidden', !this.gloryStealthMode);

    const berserkEl = document.getElementById('berserk-indicator');
    if (berserkEl) berserkEl.classList.toggle('hidden', this.snakePenaltyMs <= 0);

    const escapeEl = document.getElementById('escape-rush-indicator');
    if (escapeEl) escapeEl.classList.toggle('hidden', !this.escapeRushActive);

    const config = LEVEL_CONFIGS[gameLevel - 1];
    const goal = config.survivalGoal;
    const progressBar = document.getElementById('survival-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, (this.survivalMs / 1000 / goal) * 100).toFixed(1)}%`;
    }

    const goalEl = document.getElementById('survival-goal-label');
    if (goalEl) {
      goalEl.textContent = `Survive ${Math.floor(goal / 60)}:${String(goal % 60).padStart(2, '0')}`;
    }
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────
  private drawScene(): void {
    this.bgGraphics.clear();
    this.topGraphics.clear();
    this.overlayGraphics.clear();

    this.drawBackground();
    this.drawCollectibles();
    this.drawBushes();
    if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) { this.drawSpawnBushes(); this.drawStartGate(); this.drawExitGate(); }
    this.drawPistolPickups();
    this.drawExitZone();
    this.drawPoisonTiles();
    this.drawIQGates();
    this.drawSnakes();
    this.drawBullets();

    // Locked exit door glow (house layout, puzzle not yet solved)
    if (LEVEL_CONFIGS[gameLevel - 1].houseLayout && !this.exitPuzzleSolved) {
      const pulse = 0.25 + 0.2 * Math.sin(Date.now() / 350);
      this.topGraphics.fillStyle(0xff8800, pulse);
      this.topGraphics.fillRect(25 * CELL_SIZE, 9 * CELL_SIZE, CELL_SIZE, 3 * CELL_SIZE);
      this.topGraphics.lineStyle(2, 0xffcc44, Math.min(1, pulse + 0.3));
      this.topGraphics.strokeRect(25 * CELL_SIZE + 2, 9 * CELL_SIZE + 2, CELL_SIZE - 4, 3 * CELL_SIZE - 4);
    }

    // Hidden key drawing (house layout, key not yet taken)
    if (this.houseKey && !this.houseKey.taken) {
      this.drawHouseKey(this.houseKey.col, this.houseKey.row);
    }

    // Escape rush visuals — gold light rays from exit + red vignette
    if (this.escapeRushActive) {
      const exitX = 29 * CELL_SIZE;
      const exitY = 10 * CELL_SIZE + CELL_SIZE / 2;
      // Pulsing gold cone from exit toward center of map
      const r = 0.5 + 0.4 * Math.sin(Date.now() / 180);
      this.topGraphics.fillStyle(0xffdd44, r * 0.18);
      this.topGraphics.fillTriangle(exitX, exitY - 28, exitX, exitY + 28, exitX - 180, exitY);
      this.topGraphics.lineStyle(3, 0xffdd44, r * 0.7);
      this.topGraphics.strokeRect(28 * CELL_SIZE, 9 * CELL_SIZE, CELL_SIZE, 3 * CELL_SIZE);
      // Red danger vignette around screen edges
      const vAlpha = 0.07 + 0.05 * Math.sin(Date.now() / 200);
      this.overlayGraphics.fillStyle(0xff2200, vAlpha);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Snake berserk warning — red screen pulse
    if (this.snakePenaltyMs > 0) {
      const bPulse = 0.08 + 0.07 * Math.sin(Date.now() / 120);
      this.overlayGraphics.fillStyle(0xff0000, bPulse);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Heartbeat vignette — pulsing deep red border when 1 life left
    if (this.glory.lives === 1 && !this.roundOver) {
      const hbPhase = Math.sin(Date.now() / 430);
      const hbAlpha = hbPhase > 0 ? hbPhase * 0.22 : 0;
      if (hbAlpha > 0) {
        this.overlayGraphics.fillStyle(0xcc0000, hbAlpha);
        this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    }

    // Level 2: edge-danger crumble warning — amber flash when on a ledge edge
    if (gameLevel === 2 && this.edgeDangerWarn && this.edgeDangerMs > 0) {
      const prog = Math.min(1, this.edgeDangerMs / 1400);
      const aPulse = prog * (0.12 + 0.10 * Math.sin(Date.now() / 80));
      this.overlayGraphics.fillStyle(0xff7700, aPulse);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Crack warning text
      if (prog > 0.5) {
        const cr = this.gloryCell();
        this.topGraphics.lineStyle(2, 0xff4400, 0.7 * prog);
        this.topGraphics.strokeRect(cr.x * CELL_SIZE, cr.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Level 2: stall warning — "KEEP MOVING!" yellow flash
    if (gameLevel === 2 && this.stallWarningMs > 0) {
      const wPulse = 0.05 + 0.08 * Math.abs(Math.sin(Date.now() / 140));
      this.overlayGraphics.fillStyle(0xffdd00, wPulse);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // ── Level 2 emotional layer ────────────────────────────────────────
    if (gameLevel === 2) {
      // 1. "They're getting closer…" — red glow bleeds in from LEFT edge
      //    when the nearest hunter is within 8 cells of Glory
      let nearestHunterDist = Infinity;
      for (const sn of this.snakes) {
        if (!sn.alive || sn.behavior !== 'hunter') continue;
        const d = Math.hypot(sn.segments[0].x - this.gloryCell().x,
                             sn.segments[0].y - this.gloryCell().y);
        if (d < nearestHunterDist) nearestHunterDist = d;
      }
      if (nearestHunterDist <= 8) {
        const threat = 1 - nearestHunterDist / 8;          // 0..1
        const rAlpha = threat * (0.18 + 0.08 * Math.sin(Date.now() / 160));
        // Left-edge danger gradient (4 bands, fading right)
        for (let b = 0; b < 5; b++) {
          this.overlayGraphics.fillStyle(0xcc0000, rAlpha * (1 - b * 0.18));
          this.overlayGraphics.fillRect(b * 22, 0, 22, CANVAS_H);
        }
        // Proximity tremor when very close (≤ 3 cells)
        if (nearestHunterDist <= 3 && Math.random() < 0.04) {
          this.cameras.main.shake(80, 0.003);
        }
      }

      // 2. Speed lines — "I can't stop…" when momentum is high
      const vel = Math.hypot(this.gloryVx, this.gloryVy);
      if (vel > 1.4) {
        const intensity = Math.min(1, (vel - 1.4) / 1.2);
        const lineAlpha = intensity * 0.22;
        this.overlayGraphics.lineStyle(1, 0xffffff, lineAlpha);
        const numLines = Math.floor(6 + intensity * 10);
        for (let i = 0; i < numLines; i++) {
          const lx = Math.random() * CANVAS_W;
          const ly = Math.random() * CANVAS_H;
          const len = 18 + Math.random() * 28;
          const angle = this.facingAngle + Math.PI; // lines trail behind movement
          this.overlayGraphics.beginPath();
          this.overlayGraphics.moveTo(lx, ly);
          this.overlayGraphics.lineTo(lx + Math.cos(angle) * len, ly + Math.sin(angle) * len);
          this.overlayGraphics.strokePath();
        }
      }

      // 3. "I might fall…" — low-opacity abyss vignette (dark at bottom)
      //    intensifies when near a cracking or collapsed cell
      const nearCrack = this.unstableCells.some(uc => {
        if (uc.phase !== 'cracking' && uc.phase !== 'collapsed') return false;
        const d = Math.hypot(uc.col - this.gloryCell().x, uc.row - this.gloryCell().y);
        return d <= 2;
      });
      if (nearCrack) {
        const fPulse = 0.08 + 0.06 * Math.sin(Date.now() / 110);
        this.overlayGraphics.fillStyle(0x000000, fPulse);
        this.overlayGraphics.fillRect(0, CANVAS_H * 0.6, CANVAS_W, CANVAS_H * 0.4);
      }
    }

    if (this.activePowerUp?.kind === 'flashlight') {
      this.overlayGraphics.fillStyle(0x000000, 0.86);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
      this.overlayGraphics.lineStyle(3, 0xffee88, 0.4);
      this.overlayGraphics.strokeCircle(this.glory.x, this.glory.y, 82);
    }

    if (this.fogOfWar) {
      this.drawFogOfWar();
    }

    // House dim lighting — indoor vignette + jump scare flash
    if (LEVEL_CONFIGS[gameLevel - 1].houseLayout) {
      this.drawHouseDim();
    }

    if (this.trap) {
      this.topGraphics.lineStyle(2, 0xffff00, 0.9);
      this.topGraphics.strokeCircle(this.trap.x, this.trap.y, CELL_SIZE);
      this.topGraphics.fillStyle(0xffff00, 0.2);
      this.topGraphics.fillCircle(this.trap.x, this.trap.y, CELL_SIZE);
    }

    if (this.waitingForTrapPlacement) {
      this.topGraphics.lineStyle(1, 0xffff00, 0.5);
      this.topGraphics.strokeRect(0, 0, CANVAS_W, CANVAS_H);
    }

    this.drawGlory();

    // Floating ✓ check sign after a successful hide answer
    if (this.hideSuccessTimerMs > 0 && this.lastBushKey) {
      const [bc, br] = this.lastBushKey.split(',').map(Number);
      const bx = bc * CELL_SIZE + CELL_SIZE / 2;
      const by = br * CELL_SIZE + CELL_SIZE / 2;
      const frac = this.hideSuccessTimerMs / 3000;
      const floatY = by - 50 - (1 - frac) * 30;  // floats upward as timer expires
      const a = Math.min(1, frac * 3);            // fade out in last third
      this.topGraphics.fillStyle(0x00dd44, a);
      this.topGraphics.fillCircle(bx, floatY, 13);
      this.topGraphics.fillStyle(0xffffff, a * 0.95);
      // Checkmark — two lines forming a ✓
      this.topGraphics.lineStyle(3, 0xffffff, a);
      this.topGraphics.beginPath();
      this.topGraphics.moveTo(bx - 7, floatY);
      this.topGraphics.lineTo(bx - 2, floatY + 6);
      this.topGraphics.lineTo(bx + 7, floatY - 6);
      this.topGraphics.strokePath();
    }

    if (this.activePowerUp?.kind === 'hint') {
      this.drawHintArrow();
    }
  }

  private drawCollectibles(): void {
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const cx = c.col * CELL_SIZE + CELL_SIZE / 2;
      const cy = c.row * CELL_SIZE + CELL_SIZE / 2;

      if (c.kind === 'banana') {
        this.drawBanana(cx, cy);
      } else if (c.kind === 'berry') {
        this.drawBerry(cx, cy);
      } else {
        this.drawApple(cx, cy);
      }
    }
  }

  private drawApple(cx: number, cy: number): void {
      // Shadow
      this.bgGraphics.fillStyle(0x000000, 0.2);
      this.bgGraphics.fillEllipse(cx + 1, cy + 7, 12, 5);
      // Apple body
      this.bgGraphics.fillStyle(0xcc1111);
      this.bgGraphics.fillCircle(cx, cy + 1, 7);
      this.bgGraphics.fillStyle(0xff3333, 0.5);
      this.bgGraphics.fillCircle(cx - 1, cy, 5);
      // Indent
      this.bgGraphics.fillStyle(0x990000, 0.8);
      this.bgGraphics.fillCircle(cx, cy - 5, 2.5);
      // Stem
      this.bgGraphics.fillStyle(0x5c3a1e);
      this.bgGraphics.fillRect(cx - 0.5, cy - 8, 1.5, 4);
      // Leaf
      this.bgGraphics.fillStyle(0x2d8c22);
      this.bgGraphics.fillEllipse(cx + 4, cy - 7, 9, 5);
      this.bgGraphics.lineStyle(0.8, 0x1a5c14, 0.7);
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(cx + 1, cy - 7);
      this.bgGraphics.lineTo(cx + 7, cy - 7);
      this.bgGraphics.strokePath();
      // Shine
      this.bgGraphics.fillStyle(0xffffff, 0.55);
      this.bgGraphics.fillCircle(cx - 2, cy - 1, 2.5);
      this.bgGraphics.fillStyle(0xffffff, 0.25);
      this.bgGraphics.fillCircle(cx - 1, cy + 2, 1.5);
  }

  private drawBanana(cx: number, cy: number): void {
      // Shadow
      this.bgGraphics.fillStyle(0x000000, 0.2);
      this.bgGraphics.fillEllipse(cx + 1, cy + 7, 14, 4);
      // Banana body (curved yellow oval)
      this.bgGraphics.fillStyle(0xf5c518);
      this.bgGraphics.fillEllipse(cx, cy, 16, 8);
      this.bgGraphics.fillStyle(0xffe44d);
      this.bgGraphics.fillEllipse(cx - 1, cy - 1, 11, 5);
      // Tips (brown ends)
      this.bgGraphics.fillStyle(0x7a5c1e);
      this.bgGraphics.fillCircle(cx - 7, cy + 2, 2);
      this.bgGraphics.fillCircle(cx + 7, cy - 2, 2);
      // Shine
      this.bgGraphics.fillStyle(0xffffff, 0.4);
      this.bgGraphics.fillEllipse(cx - 2, cy - 2, 5, 2.5);
  }

  private drawBerry(cx: number, cy: number): void {
      // Shadow
      this.bgGraphics.fillStyle(0x000000, 0.2);
      this.bgGraphics.fillEllipse(cx + 1, cy + 7, 12, 4);
      // Three berries cluster (purple/magenta)
      const berryColor = 0xcc2288;
      const berryHighlight = 0xff44aa;
      this.bgGraphics.fillStyle(berryColor);
      this.bgGraphics.fillCircle(cx - 3, cy + 2, 4.5);
      this.bgGraphics.fillCircle(cx + 3, cy + 2, 4.5);
      this.bgGraphics.fillCircle(cx, cy - 2, 4.5);
      // Highlights
      this.bgGraphics.fillStyle(berryHighlight, 0.5);
      this.bgGraphics.fillCircle(cx - 4, cy + 1, 2);
      this.bgGraphics.fillCircle(cx + 2, cy + 1, 2);
      this.bgGraphics.fillCircle(cx - 1, cy - 3, 2);
      // Stem
      this.bgGraphics.fillStyle(0x2d8c22);
      this.bgGraphics.fillRect(cx - 0.5, cy - 7, 1.5, 4);
      // Shine spots
      this.bgGraphics.fillStyle(0xffffff, 0.5);
      this.bgGraphics.fillCircle(cx - 4, cy, 1.2);
      this.bgGraphics.fillCircle(cx + 2, cy, 1.2);
      this.bgGraphics.fillCircle(cx - 1, cy - 4, 1.2);
  }

  private drawHouseKey(col: number, row: number): void {
    const cx = col * CELL_SIZE + CELL_SIZE / 2;
    const cy = row * CELL_SIZE + CELL_SIZE / 2;
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);

    // Glow halo
    this.topGraphics.fillStyle(0xffdd00, pulse * 0.25);
    this.topGraphics.fillCircle(cx, cy, 13);
    this.topGraphics.lineStyle(1.5, 0xffdd00, pulse * 0.6);
    this.topGraphics.strokeCircle(cx, cy, 13);

    const g = this.bgGraphics;
    // Key ring (circle)
    g.fillStyle(0xffcc00);
    g.fillCircle(cx - 2, cy - 2, 5);
    g.fillStyle(0x000000, 0.0);
    g.fillCircle(cx - 2, cy - 2, 2.5); // punch-out hole
    g.lineStyle(2, 0xffffff, 0.35);
    g.strokeCircle(cx - 2, cy - 2, 5);

    // Key shaft
    g.fillStyle(0xffcc00);
    g.fillRect(cx - 1, cy - 1, 9, 2.5);

    // Key teeth
    g.fillRect(cx + 4, cy + 1, 2, 3);
    g.fillRect(cx + 7, cy + 1, 2, 2);
  }


  private drawPistolPickups(): void {
    const g = this.bgGraphics;
    const pulse = 0.75 + 0.25 * Math.sin(this.exitPulseTimer / 380);
    for (const p of this.pistolPickups) {
      if (p.taken) continue;
      const cx = p.col * CELL_SIZE + CELL_SIZE / 2;
      const cy = p.row * CELL_SIZE + CELL_SIZE / 2;

      // Glow ring
      g.fillStyle(0xffcc00, 0.28 * pulse);
      g.fillCircle(cx, cy, 12);

      // Gun body (dark grey barrel + grip)
      g.fillStyle(0x333333);
      g.fillRoundedRect(cx - 9, cy - 3, 18, 6, 2);   // barrel + body
      g.fillRoundedRect(cx - 2, cy + 3, 6, 7, 1);    // grip
      // Highlight
      g.fillStyle(0x888888, 0.55);
      g.fillRect(cx - 8, cy - 2, 15, 2);
      // Barrel tip
      g.fillStyle(0x555555);
      g.fillRect(cx + 8, cy - 2, 3, 4);

      // Small star sparkle above
      g.fillStyle(0xffee44, 0.90 * pulse);
      g.fillCircle(cx, cy - 13, 3);
      g.fillCircle(cx - 4, cy - 11, 1.5);
      g.fillCircle(cx + 4, cy - 11, 1.5);
    }
  }

  private drawBullets(): void {
    const g = this.topGraphics;
    for (const b of this.bullets) {
      const t = Math.min(1, b.progress);
      const bx = b.x + (b.tx - b.x) * t;
      const by = b.y + (b.ty - b.y) * t;
      const alpha = b.done ? Math.max(0, 1.8 - b.progress) : 1;

      // Yellow bullet streak
      g.lineStyle(3, 0xffee00, alpha * 0.9);
      g.beginPath();
      const tailT = Math.max(0, t - 0.18);
      g.moveTo(b.x + (b.tx - b.x) * tailT, b.y + (b.ty - b.y) * tailT);
      g.lineTo(bx, by);
      g.strokePath();

      // Bullet tip glow
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(bx, by, 3.5);
      g.fillStyle(0xffee00, alpha * 0.7);
      g.fillCircle(bx, by, 6);

      // Impact flash when done
      if (b.done && b.progress < 1.5) {
        const flash = (1.5 - b.progress) / 0.5;
        g.fillStyle(0xffffff, flash * 0.9);
        g.fillCircle(b.tx, b.ty, 10 * flash);
        g.fillStyle(0xffee00, flash * 0.6);
        g.fillCircle(b.tx, b.ty, 16 * flash);
      }
    }
  }

  // ── Level 1: spawn bushes where snakes hide before emerging ──────────────
  private drawSpawnBushes(): void {
    const g = this.bgGraphics;
    const t = this.exitPulseTimer;

    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const sx = snake.spawnCol * CELL_SIZE + CELL_SIZE / 2;
      const sy = snake.spawnRow * CELL_SIZE + CELL_SIZE / 2;

      // ── Permanent plant/flower cluster — always visible ──────────────
      const sway = Math.sin(t / 900 + sx * 0.04) * 1.5;

      // Ground shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(sx + 2, sy + 9, 32, 8);

      // Tall grass blades (back layer, sway gently)
      const bladeColors = [0x2d8a14, 0x3da820, 0x1a6b0a, 0x48b818];
      for (let b = 0; b < 6; b++) {
        const bx = sx + (b - 2.5) * 4.5;
        const bh = 10 + (b % 3) * 5;
        g.fillStyle(bladeColors[b % 4], 0.80);
        g.fillTriangle(
          bx + sway, sy - bh,
          bx - 2, sy + 2,
          bx + 2.5, sy + 2
        );
      }

      // Main bush body (mid layer)
      g.fillStyle(0x1a6b0a, 0.88);
      g.fillEllipse(sx, sy - 4, 28, 20);
      g.fillStyle(0x2d9418, 0.72);
      g.fillEllipse(sx - 5, sy - 9, 20, 14);
      g.fillStyle(0x48c020, 0.50);
      g.fillEllipse(sx + 3, sy - 13, 14, 10);

      // Small flowers on top of bush
      const flowerData = [
        { ox: -7, oy: -11, petal: 0xff6699, center: 0xffee44 },
        { ox:  5, oy: -14, petal: 0xff88cc, center: 0xffffff },
        { ox:  0, oy:  -8, petal: 0xffaadd, center: 0xffcc00 },
        { ox: -3, oy: -16, petal: 0xff44aa, center: 0xffff88 },
      ];
      for (const f of flowerData) {
        const fx = sx + f.ox;
        const fy = sy + f.oy;
        // Petals
        g.fillStyle(f.petal, 0.90);
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2 + t * 0.0004;
          g.fillCircle(fx + Math.cos(pa) * 3.5, fy + Math.sin(pa) * 3.5, 2.5);
        }
        // Center
        g.fillStyle(f.center, 0.95);
        g.fillCircle(fx, fy, 2.0);
      }

      // Leaf accents
      g.fillStyle(0x3daa1a, 0.65);
      g.fillEllipse(sx - 10, sy - 6, 12, 6);
      g.fillEllipse(sx + 9, sy - 5, 10, 6);

      // ── Peeking eyes when snake is hiding ────────────────────────────
      if (!snake.emerged && !snake.retreating) {
        // Snake lurks inside — glowing eyes visible through foliage
        const eyeGlow = 0.70 + 0.30 * Math.sin(t / 400);
        g.fillStyle(0x000000, 0.80);
        g.fillCircle(sx - 5, sy - 3, 3.5);
        g.fillCircle(sx + 5, sy - 3, 3.5);
        g.fillStyle(snake.color, eyeGlow);
        g.fillCircle(sx - 5, sy - 3, 2.6);
        g.fillCircle(sx + 5, sy - 3, 2.6);
        // Tiny pupil
        g.fillStyle(0x000000, 0.60);
        g.fillCircle(sx - 5, sy - 3, 1.1);
        g.fillCircle(sx + 5, sy - 3, 1.1);
      }

      // ── Fading overlay when retreating (snake returning to plants) ───
      if (snake.retreating) {
        const pulse = 0.4 + 0.3 * Math.sin(t / 250);
        g.fillStyle(0x48c020, 0.30 * pulse);
        g.fillEllipse(sx, sy - 4, 30, 22);
      }
    }
  }

  // ── Level 1: wooden start gate across the upper corridor ─────────────────
  private drawStartGate(): void {
    const g = this.bgGraphics;
    // Gate spans the corridor at col 3.5, rows 4–9 (y 80–180)
    const gx  = 1 * CELL_SIZE;          // x = 20  — at the fence entrance (col 1)
    const top = 4 * CELL_SIZE;           // flush with top wall row 4
    const bot = 9 * CELL_SIZE;           // flush with bottom wall row 9
    const h   = bot - top;               // corridor height

    if (!this.gateOpen) {
      // Closed gate: wooden planks filling the corridor
      // Post (left side of path)
      g.fillStyle(0x5c3317);
      g.fillRect(gx - 4, top, 6, h);
      g.fillStyle(0x7a4422, 0.6);
      g.fillRect(gx - 3, top, 2, h);

      // Horizontal planks
      const plankColor = 0x8b5e2a;
      const plankH = Math.floor(h / 5);
      for (let i = 0; i < 5; i++) {
        const py = top + i * plankH;
        g.fillStyle(plankColor, 0.95);
        g.fillRect(gx, py + 1, 18, plankH - 2);
        g.fillStyle(0xaa7840, 0.40);
        g.fillRect(gx + 1, py + 2, 16, Math.floor(plankH * 0.35));
        // Plank gap shadow
        g.fillStyle(0x2a1800, 0.55);
        g.fillRect(gx, py + plankH - 1, 18, 2);
      }

      // Cross-bar brace
      g.fillStyle(0x6b4420, 0.80);
      g.fillRect(gx, top + 4, 18, 3);
      g.fillRect(gx, bot - 7, 18, 3);

      // Latch / padlock
      g.fillStyle(0xccaa00);
      g.fillRoundedRect(gx + 5, top + Math.floor(h / 2) - 6, 8, 10, 2);
      g.fillStyle(0x886600);
      g.fillRect(gx + 7, top + Math.floor(h / 2) - 9, 4, 5);

      // "→ OPEN" hint label above gate
      const pulse = 0.7 + 0.3 * Math.sin(this.exitPulseTimer / 350);
      g.fillStyle(0xffee44, 0.88 * pulse);
      g.fillTriangle(gx + 22, top - 8, gx + 14, top - 14, gx + 14, top - 2);
      g.fillRect(gx + 6, top - 10, 9, 5);

    } else {
      // Open gate: planks swung to the left (animation)
      const frac = Math.min(1, this.gateOpenAnimMs / 600);
      const swingW = Math.round(18 * (1 - frac)); // planks shrink as gate swings

      // Post stays
      g.fillStyle(0x5c3317);
      g.fillRect(gx - 4, top, 6, h);

      if (swingW > 1) {
        const plankH = Math.floor(h / 5);
        for (let i = 0; i < 5; i++) {
          const py = top + i * plankH;
          g.fillStyle(0x8b5e2a, 0.90 * (1 - frac));
          g.fillRect(gx - swingW, py + 1, swingW, plankH - 2);
        }
      }

      // Broken-open sparkle on first frame
      if (frac < 0.40) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + this.exitPulseTimer * 0.03;
          g.fillStyle(0xffee44, (0.40 - frac) * 2.5);
          g.fillCircle(gx + Math.cos(a) * 10, (top + bot) / 2 + Math.sin(a) * 12, 2);
        }
      }
    }
  }

  // ── Level 1: wooden exit gate at the right end of the lower corridor ─────
  private drawExitGate(): void {
    const g  = this.bgGraphics;
    const t  = this.exitPulseTimer;
    const gx  = 30 * CELL_SIZE;           // x = 600  (right edge of gate)
    const top = 18 * CELL_SIZE;           // y = 360
    const bot = 22 * CELL_SIZE;           // y = 440
    const h   = bot - top;               // 80px corridor height
    const cx  = gx - 9;                  // gate centre x
    const cy  = (top + bot) / 2;         // gate centre y

    // ── Stone arch pillars (always visible) ───────────────────────────────────
    const pillarW = 8;
    // Top pillar
    g.fillStyle(0x3a3a50);
    g.fillRect(gx - 20, top - 4, 24, pillarW + 4);
    g.fillStyle(0x55556a, 0.6);
    g.fillRect(gx - 18, top - 2, 20, pillarW * 0.4);
    // Bottom pillar
    g.fillStyle(0x3a3a50);
    g.fillRect(gx - 20, bot - pillarW, 24, pillarW + 4);
    g.fillStyle(0x55556a, 0.6);
    g.fillRect(gx - 18, bot - pillarW, 20, pillarW * 0.4);
    // Side post
    g.fillStyle(0x2a2a3e);
    g.fillRect(gx - 4, top, 8, h);

    if (this.exitGateOpenAnimMs < 0) {
      // ── CLOSED: venom curtain + swirling energy ──────────────────────────────
      const pulse  = 0.6 + 0.4 * Math.sin(t / 380);
      const pulse2 = 0.6 + 0.4 * Math.sin(t / 280 + 1.2);

      // Dark void background
      g.fillStyle(0x050510, 0.92);
      g.fillRect(gx - 20, top + pillarW, 20, h - pillarW * 2);

      // Swirling inner venom rings
      for (let ring = 0; ring < 4; ring++) {
        const ringAngle = t * 0.0018 * (ring % 2 === 0 ? 1 : -1) + ring * 0.8;
        const ringR   = 6 + ring * 4;
        const alpha   = (0.5 - ring * 0.08) * pulse;
        g.fillStyle(0x00ff66, alpha);
        g.fillCircle(cx + Math.cos(ringAngle) * 4, cy + Math.sin(ringAngle) * 8, ringR * 0.55);
      }

      // Vertical venom tendrils
      for (let k = 0; k < 5; k++) {
        const tx2  = gx - 18 + k * 4 + Math.sin(t * 0.003 + k * 1.1) * 2;
        const ty1 = top + pillarW + 4 + Math.sin(t * 0.004 + k) * 4;
        const ty2 = bot - pillarW - 4 + Math.cos(t * 0.004 + k * 0.7) * 4;
        g.lineStyle(1.4, 0x00dd55, 0.35 * pulse);
        g.beginPath(); g.moveTo(tx2, ty1); g.lineTo(tx2, ty2); g.strokePath();
      }

      // Centre glow
      g.fillStyle(0x00ff88, 0.18 * pulse);
      g.fillEllipse(cx, cy, 22, 36);
      g.fillStyle(0x00ff44, 0.30 * pulse2);
      g.fillEllipse(cx, cy, 10, 18);

      // Arcane lock rune (replacing the old padlock)
      // Outer hexagon-ish ring
      g.lineStyle(1.8, 0x00ff88, 0.80 * pulse);
      g.strokeCircle(cx, cy, 11);
      g.lineStyle(1.2, 0x00cc66, 0.55 * pulse2);
      g.strokeCircle(cx, cy, 7);
      // Cross in centre
      g.lineStyle(2, 0x00ff88, 0.90 * pulse);
      g.beginPath();
      g.moveTo(cx - 5, cy); g.lineTo(cx + 5, cy);
      g.moveTo(cx, cy - 5); g.lineTo(cx, cy + 5);
      g.strokePath();
      // Diagonal marks
      g.lineStyle(1.2, 0x44ffaa, 0.70 * pulse);
      for (let d = 0; d < 4; d++) {
        const da = d * Math.PI / 2 + Math.PI / 4 + t * 0.0008;
        g.beginPath();
        g.moveTo(cx + Math.cos(da) * 7, cy + Math.sin(da) * 7);
        g.lineTo(cx + Math.cos(da) * 12, cy + Math.sin(da) * 12);
        g.strokePath();
      }

      // Outer glow halo
      g.fillStyle(0x00ff66, 0.10 * pulse);
      g.fillEllipse(cx, cy, 42, 60);

      // Hint arrow pulsing above gate
      const arrowPulse = 0.7 + 0.3 * Math.sin(t / 280);
      g.fillStyle(0x00ff88, 0.88 * arrowPulse);
      g.fillTriangle(cx, top - 5, cx - 7, top - 14, cx + 7, top - 14);
      g.fillRect(cx - 2.5, top - 22, 5, 9);

    } else {
      // ── OPEN: glowing vortex portal ─────────────────────────────────────────
      const frac   = Math.min(1, this.exitGateOpenAnimMs / 700);  // 0→1 over 700ms
      const spinT  = t * 0.003;

      // Swirling vortex fill — layers of rotating ellipses
      const vortexLayers = [
        { r: 26, col: 0x00ff66, a: 0.22 },
        { r: 20, col: 0x22ff88, a: 0.30 },
        { r: 13, col: 0x44ffaa, a: 0.40 },
        { r:  7, col: 0xaaffd4, a: 0.55 },
        { r:  3, col: 0xffffff, a: 0.80 },
      ];
      for (let i = 0; i < vortexLayers.length; i++) {
        const vl = vortexLayers[i];
        const angle = spinT * (i % 2 === 0 ? 1 : -1.3) + i * 0.6;
        const ox = Math.cos(angle) * 2;
        const oy = Math.sin(angle) * 3;
        g.fillStyle(vl.col, vl.a);
        g.fillEllipse(cx + ox, cy + oy, vl.r * 2, vl.r * 2.6);
      }

      // Streaming particles from portal outward
      const particleCount = 14;
      for (let i = 0; i < particleCount; i++) {
        const pa    = (i / particleCount) * Math.PI * 2 + spinT * 2.2 + i * 0.4;
        const dist  = 12 + ((t * 0.8 + i * 17) % 22);
        const px    = cx + Math.cos(pa) * dist;
        const py    = cy + Math.sin(pa) * dist * 1.4;
        const pSize = 1.5 + Math.sin(t * 0.01 + i) * 1.2;
        const pAlpha = 0.55 + 0.45 * Math.sin(t * 0.008 + i * 0.7);
        g.fillStyle(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0x00ff88 : 0x44ffcc, pAlpha);
        g.fillCircle(px, py, Math.max(0.5, pSize));
      }

      // Outer glow ring (expands on first open)
      const glowR = 20 + frac * 14;
      g.fillStyle(0x00ff66, 0.12 + 0.08 * Math.sin(t / 200));
      g.fillEllipse(cx, cy, glowR * 2.2, glowR * 3.2);

      // Burst flash on first 300ms
      if (frac < 0.45) {
        const flashAlpha = (0.45 - frac) * 1.8;
        g.fillStyle(0x00ff88, flashAlpha * 0.5);
        g.fillRect(gx - 22, top + pillarW, 22, h - pillarW * 2);
        // Burst rays
        for (let r2 = 0; r2 < 8; r2++) {
          const ra = (r2 / 8) * Math.PI * 2;
          const rLen = 18 * flashAlpha;
          g.lineStyle(1.5, 0x88ffcc, flashAlpha * 0.7);
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(ra) * rLen, cy + Math.sin(ra) * rLen * 1.5);
          g.strokePath();
        }
      }

      // Pillar glow tint when open
      g.fillStyle(0x00ff44, 0.18);
      g.fillRect(gx - 20, top - 4, 24, pillarW + 4);
      g.fillRect(gx - 20, bot - pillarW, 24, pillarW + 4);
    }
  }

  private drawBushes(): void {
    for (const key of this.bushCells) {
      const [col, row] = key.split(',').map(Number);
      const cx = col * CELL_SIZE + CELL_SIZE / 2;
      const cy = row * CELL_SIZE + CELL_SIZE / 2;

      if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) {
        // Level 1 (Mountain Path): draw as a large hiding tree
        const pulse = 0.75 + 0.25 * Math.sin(this.exitPulseTimer / 420 + col * 1.3);
        const g = this.bgGraphics;

        // Ground shadow
        g.fillStyle(0x000000, 0.20);
        g.fillEllipse(cx + 3, cy + 14, 36, 10);

        // Trunk
        g.fillStyle(0x5c3317);
        g.fillRect(cx - 4, cy - 2, 8, 20);
        // Trunk highlight
        g.fillStyle(0x7a4a22, 0.5);
        g.fillRect(cx - 2, cy - 2, 3, 20);

        // Canopy — three layered ellipses (dark base → mid green → bright top)
        g.fillStyle(0x1b5c0a);
        g.fillEllipse(cx, cy - 18, 46, 34);

        g.fillStyle(0x2d8a14, 0.80);
        g.fillEllipse(cx - 2, cy - 26, 34, 22);

        g.fillStyle(0x48c820, 0.55);
        g.fillEllipse(cx + 1, cy - 32, 22, 14);

        // Sunlight glint on top-left of canopy
        g.fillStyle(0x88ff44, 0.28 * pulse);
        g.fillEllipse(cx - 7, cy - 34, 12, 8);

        // Pulsing green glow ring — signals this is a hiding spot
        g.lineStyle(2.2, 0x44ff88, 0.70 * pulse);
        g.strokeCircle(cx, cy - 18, 26);

        // Pulsing arrow pointing down into the tree
        const arrowY = cy - 46;
        g.fillStyle(0x44ff99, 0.90 * pulse);
        g.fillTriangle(cx, arrowY + 9, cx - 7, arrowY, cx + 7, arrowY);
        g.fillRect(cx - 2.5, arrowY - 7, 5, 9);

        // Answered state badge (top-right of canopy)
        if (this.bushChallengeAnswered && this.lastBushKey === key) {
          if (this.hidingSuccess) {
            // Green check badge
            g.fillStyle(0x00cc44, 0.92);
            g.fillCircle(cx + 16, cy - 32, 6);
            g.fillStyle(0xffffff, 0.95);
            g.fillRect(cx + 12, cy - 33, 2.5, 5);
            g.fillRect(cx + 14, cy - 30, 4.5, 2.5);
          } else if (this.hidingSearchMs > 0) {
            // Red X badge
            g.fillStyle(0xee2222, 0.92);
            g.fillCircle(cx + 16, cy - 32, 6);
            g.fillStyle(0xffffff, 0.95);
            g.fillRect(cx + 12.5, cy - 35, 2, 10);
            g.fillRect(cx + 12.5, cy - 35, 7, 2);
          }
        }
      } else {
        // Default bush: layered green circles
        this.bgGraphics.fillStyle(0x1a6b2a, 0.9);
        this.bgGraphics.fillCircle(cx, cy, 10);
        this.bgGraphics.fillStyle(0x2d9440, 0.85);
        this.bgGraphics.fillCircle(cx - 4, cy - 2, 7);
        this.bgGraphics.fillCircle(cx + 4, cy - 2, 7);
        this.bgGraphics.fillCircle(cx, cy - 5, 6);
        this.bgGraphics.fillStyle(0x55cc66, 0.4);
        this.bgGraphics.fillCircle(cx - 2, cy - 5, 4);
        this.bgGraphics.fillStyle(0x0d3d14, 0.5);
        this.bgGraphics.fillEllipse(cx, cy + 6, 18, 6);
      }
    }
  }

  private drawExitZone(): void {
    if (!this.exitZone) return;
    const cx = this.exitZone.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = this.exitZone.row * CELL_SIZE + CELL_SIZE / 2;
    const pulse = 0.55 + 0.45 * Math.sin(this.exitPulseTimer / 350);

    // Golden glow behind the arch
    this.bgGraphics.fillStyle(0xffcc00, 0.12 * pulse);
    this.bgGraphics.fillCircle(cx, cy, 22);
    this.bgGraphics.fillStyle(0xffaa00, 0.25 * pulse);
    this.bgGraphics.fillCircle(cx, cy, 14);

    // Arch left pillar
    this.bgGraphics.fillStyle(0x8b7355);
    this.bgGraphics.fillRect(cx - 14, cy - 14, 7, 22);
    // Arch right pillar
    this.bgGraphics.fillRect(cx + 7, cy - 14, 7, 22);

    // Stone highlight on pillars
    this.bgGraphics.fillStyle(0xb09070, 0.6);
    this.bgGraphics.fillRect(cx - 14, cy - 14, 3, 22);
    this.bgGraphics.fillRect(cx + 7, cy - 14, 3, 22);

    // Arch curved top (using filled ellipse cutout trick)
    this.bgGraphics.fillStyle(0x8b7355);
    this.bgGraphics.fillRect(cx - 14, cy - 18, 28, 8);
    // Arch opening (darker inner arc)
    this.bgGraphics.fillStyle(0x3a2a10);
    this.bgGraphics.fillEllipse(cx, cy - 14, 20, 14);

    // Glowing light inside arch (pulsing gold)
    this.bgGraphics.fillStyle(0xffee88, 0.6 * pulse);
    this.bgGraphics.fillEllipse(cx, cy - 10, 14, 10);
    this.bgGraphics.fillStyle(0xffffff, 0.4 * pulse);
    this.bgGraphics.fillCircle(cx, cy - 12, 4);

    // Sparkle dots around arch
    for (let i = 0; i < 5; i++) {
      const angle = (this.exitPulseTimer / 500) + (i / 5) * Math.PI * 2;
      const sx = cx + Math.cos(angle) * 18;
      const sy = cy + Math.sin(angle) * 12;
      this.bgGraphics.fillStyle(0xffdd44, 0.8 * pulse);
      this.bgGraphics.fillCircle(sx, sy, 1.5);
    }

    // "GOAL" label above arch
    this.bgGraphics.fillStyle(0x000000, 0.55);
    this.bgGraphics.fillRoundedRect(cx - 16, cy - 30, 32, 11, 4);
    this.bgGraphics.fillStyle(0xffdd00, 0.95);
    this.bgGraphics.fillRoundedRect(cx - 15, cy - 31, 30, 10, 3);
  }

  // ── House interior background ────────────────────────────────────────────
  private drawHouseBackground(): void {
    const g = this.bgGraphics;

    // Wooden floor tiles — warm tan/brown checkerboard
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const even = (col + row) % 2 === 0;
        g.fillStyle(even ? 0xc8a265 : 0xb8925a, 1.0);
        g.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // Subtle wood grain lines on every tile
    g.lineStyle(0.5, 0x9a7040, 0.25);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        // Horizontal grain stroke
        g.beginPath();
        g.moveTo(x + 2, y + CELL_SIZE * 0.35);
        g.lineTo(x + CELL_SIZE - 2, y + CELL_SIZE * 0.35);
        g.strokePath();
        g.beginPath();
        g.moveTo(x + 2, y + CELL_SIZE * 0.7);
        g.lineTo(x + CELL_SIZE - 2, y + CELL_SIZE * 0.7);
        g.strokePath();
      }
    }

    // Tile border grid lines
    g.lineStyle(0.8, 0x7a5530, 0.35);
    for (let row = 0; row <= ROWS; row++) {
      g.beginPath();
      g.moveTo(0, row * CELL_SIZE);
      g.lineTo(CANVAS_W, row * CELL_SIZE);
      g.strokePath();
    }
    for (let col = 0; col <= COLS; col++) {
      g.beginPath();
      g.moveTo(col * CELL_SIZE, 0);
      g.lineTo(col * CELL_SIZE, CANVAS_H);
      g.strokePath();
    }

    // Walls drawn as dark brick/stone over the floor
    for (const key of this.walls) {
      const [col, row] = key.split(',').map(Number);
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;

      // Stone wall base
      g.fillStyle(0x4a3a28);
      g.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Brick pattern — alternating offsets
      const brickOffset = row % 2 === 0 ? 0 : CELL_SIZE / 2;
      g.fillStyle(0x5c4830, 0.9);
      g.fillRect(x + brickOffset % CELL_SIZE, y + 2, CELL_SIZE / 2 - 1, CELL_SIZE / 2 - 2);
      g.fillRect(x + (brickOffset + CELL_SIZE / 2) % CELL_SIZE, y + CELL_SIZE / 2 + 1, CELL_SIZE / 2 - 1, CELL_SIZE / 2 - 2);

      // Mortar lines
      g.lineStyle(1, 0x2e2018, 0.8);
      g.beginPath(); g.moveTo(x, y + CELL_SIZE / 2); g.lineTo(x + CELL_SIZE, y + CELL_SIZE / 2); g.strokePath();
      g.lineStyle(1, 0x2e2018, 0.5);
      g.beginPath(); g.moveTo(x + CELL_SIZE / 2, y); g.lineTo(x + CELL_SIZE / 2, y + CELL_SIZE / 2); g.strokePath();

      // Top-edge highlight (gives depth)
      g.fillStyle(0x7a6045, 0.3);
      g.fillRect(x, y, CELL_SIZE, 2);
    }
  }

  // ── Level 1: Clean Mountain Path background ──────────────────────────────
  private drawLevel1Background(): void {
    const g = this.bgGraphics;

    // Key pixel positions for Z-path walls:
    //   Upper corridor: rows 5-8  (walls at row 4 top, row 9 bottom)
    //   Connector:      cols 17-19 (walls at col 20 right, col 16 left)
    //   Lower corridor: rows 19-21 (walls at row 18 top, row 22 bottom)
    const upTopY = 4  * CELL_SIZE;  // 80
    const upBotY = 9  * CELL_SIZE;  // 180
    const loTopY = 18 * CELL_SIZE;  // 360
    const loBotY = 22 * CELL_SIZE;  // 440
    const connLX = 16 * CELL_SIZE;  // 320
    const connRX = 20 * CELL_SIZE;  // 400

    // ── 1. Full canvas base: rocky cliff colour ───────────────────────
    g.fillStyle(0x4a3c2a);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── 2. Sky area (above upper segment + right column) ─────────────
    g.fillStyle(0x8fd3f0);
    g.fillRect(0, 0, CANVAS_W, upTopY + 20);
    // Lighter horizon band
    g.fillStyle(0xc2e8f8, 0.45);
    g.fillRect(0, 15, CANVAS_W, upTopY);

    // 3 soft clouds
    const cloud = (cx: number, cy: number, s: number) => {
      g.fillStyle(0xffffff, 0.84);
      g.fillEllipse(cx,          cy,          56 * s, 20 * s);
      g.fillEllipse(cx - 17 * s, cy +  5 * s, 33 * s, 16 * s);
      g.fillEllipse(cx + 17 * s, cy +  4 * s, 36 * s, 17 * s);
      g.fillEllipse(cx,          cy -  8 * s, 25 * s, 13 * s);
    };
    cloud(80,  28, 0.80);
    cloud(295, 18, 1.00);
    cloud(510, 34, 0.75);

    // Soft mountain silhouettes behind upper segment
    g.fillStyle(0xb0a8c0, 0.48);
    g.fillEllipse(100,  upTopY + 14, 230,  96);
    g.fillEllipse(315,  upTopY +  4, 270, 110);
    g.fillEllipse(530,  upTopY + 16, 210,  92);
    g.fillStyle(0xd0c8de, 0.30);
    g.fillEllipse(205, upTopY -  4, 152, 66);
    g.fillEllipse(435, upTopY -  6, 168, 68);
    // Snow caps on two tallest mountains
    g.fillStyle(0xffffff, 0.38);
    g.fillEllipse(315, upTopY - 8,  82, 24);
    g.fillEllipse(530, upTopY - 2,  64, 18);

    // ── 3. Cliff texture (non-path areas) ────────────────────────────
    // Left-middle cliff (x=0-connLX, y=upBotY-loTopY) — below upper, beside connector
    g.fillStyle(0x3e3020);
    g.fillRect(0, upBotY, connLX, loTopY - upBotY);
    // Rock strata lines
    g.fillStyle(0x2e2416, 0.55);
    for (let ry = upBotY + 14; ry < loTopY; ry += 20) {
      const rw = connLX * (0.5 + 0.4 * ((ry % 40) / 40));
      g.fillRect(0, ry, rw, 5);
    }
    // Lighter strata highlight
    g.fillStyle(0x6a5438, 0.22);
    for (let ry = upBotY + 5; ry < loTopY; ry += 20) {
      g.fillRect(0, ry, connLX * 0.6, 3);
    }

    // Right-upper cliff (x=connRX-CANVAS_W, y=upBotY-loTopY) — beside connector right
    g.fillStyle(0x3e3020);
    g.fillRect(connRX, upBotY, CANVAS_W - connRX, loTopY - upBotY);
    g.fillStyle(0x2e2416, 0.45);
    for (let ry = upBotY + 8; ry < loTopY; ry += 20) {
      g.fillRect(connRX + 8, ry, (CANVAS_W - connRX) * 0.7, 4);
    }

    // Bottom cliff (below lower segment)
    g.fillStyle(0x332818);
    g.fillRect(0, loBotY, CANVAS_W, CANVAS_H - loBotY);
    g.fillStyle(0x28200e, 0.5);
    for (let ry = loBotY + 8; ry < CANVAS_H - 28; ry += 14) {
      g.fillRect(0, ry, CANVAS_W, 4);
    }

    // Water strip at very bottom (visible below the cliff)
    g.fillStyle(0x1565c0);
    g.fillRect(0, CANVAS_H - 28, CANVAS_W, 28);
    g.fillStyle(0x1e88e5, 0.6);
    g.fillRect(0, CANVAS_H - 18, CANVAS_W, 14);
    // Animated water ripples
    const rippleOff = (this.exitPulseTimer / 6) % 50;
    g.fillStyle(0x64b5f6, 0.38);
    for (let wx = -50 + rippleOff; wx < CANVAS_W + 50; wx += 50) {
      g.fillEllipse(wx, CANVAS_H - 13, 38, 5);
    }

    // ── 4. PATH fills (sandy beige) ───────────────────────────────────
    // Upper segment (including wall rows for seamless look)
    g.fillStyle(0xe8d598);
    g.fillRect(0, upTopY, connRX, upBotY - upTopY);
    // Connector (column)
    g.fillRect(connLX, upTopY, connRX - connLX, loTopY - upTopY);
    // Lower segment
    g.fillRect(connLX, loTopY, CANVAS_W - connLX, loBotY - loTopY);

    // Path centre highlight
    const uCY = (upTopY + upBotY) / 2;
    const lCY = (loTopY + loBotY) / 2;
    const cCX = (connLX + connRX) / 2;
    g.fillStyle(0xf4e9be, 0.36);
    g.fillRect(CELL_SIZE, uCY - 7, connRX - CELL_SIZE * 2, 14);         // upper
    g.fillRect(cCX - 6, upBotY, 12, loTopY - upBotY);                   // connector
    g.fillRect(connRX + CELL_SIZE, lCY - 7, CANVAS_W - connRX - CELL_SIZE * 2, 14); // lower

    // Edge shadows near walls (depth effect)
    g.fillStyle(0xc4a860, 0.18);
    g.fillRect(0, upTopY, connRX, 15);                   // upper top
    g.fillRect(0, upBotY - 15, connLX, 15);              // upper bottom
    g.fillRect(connLX, loTopY, CANVAS_W - connLX, 15);   // lower top
    g.fillRect(connLX, loBotY - 15, CANVAS_W - connLX, 15); // lower bottom

    // ── 5. DIRECTION GUIDE DOTS along path centre ─────────────────────
    g.fillStyle(0xfff2aa, 0.62);
    // Upper: horizontal dots
    for (let dx = 35; dx < connRX - 15; dx += 22) {
      g.fillCircle(dx, uCY, 2.5);
    }
    // Connector: vertical dots (curve indicator)
    for (let dy = upBotY + 15; dy < loTopY - 15; dy += 22) {
      g.fillCircle(cCX, dy, 2.5);
    }
    // Lower: horizontal dots
    for (let dx = connRX + 15; dx < CANVAS_W - 28; dx += 22) {
      g.fillCircle(dx, lCY, 2.5);
    }

    // ── 6. BAMBOO FENCE helpers ───────────────────────────────────────
    const fenceH = (x1: number, x2: number, fy: number) => {
      g.fillStyle(0xa87828);
      g.fillRect(x1, fy - 2, x2 - x1, 3);
      g.fillRect(x1, fy + 4, x2 - x1, 2);
      for (let fx = x1 + 2; fx < x2; fx += 20) {
        g.fillStyle(0xc89040);
        g.fillRect(fx, fy - 8, 5, 18);
        g.fillStyle(0xdcb060, 0.6);
        g.fillRect(fx, fy - 8, 2, 18);
        g.fillStyle(0xa07030, 0.42);
        g.fillRect(fx, fy + 1, 5, 2);
      }
    };
    const fenceV = (fx: number, y1: number, y2: number) => {
      g.fillStyle(0xa87828);
      g.fillRect(fx - 2, y1, 3, y2 - y1);
      g.fillRect(fx + 4, y1, 2, y2 - y1);
      for (let fy = y1 + 2; fy < y2; fy += 20) {
        g.fillStyle(0xc89040);
        g.fillRect(fx - 8, fy, 18, 5);
        g.fillStyle(0xdcb060, 0.6);
        g.fillRect(fx - 8, fy, 18, 2);
        g.fillStyle(0xa07030, 0.42);
        g.fillRect(fx + 2, fy, 2, 5);
      }
    };

    // Upper segment top fence    (row 4,  cols 1-19 = x 20-380)
    fenceH(CELL_SIZE, connRX, upTopY);
    // Upper segment bottom fence (row 9,  cols 1-15 = x 20-300)  -- stops at cliff
    fenceH(CELL_SIZE, 16 * CELL_SIZE, upBotY);
    // Connector right fence      (col 20, rows 5-17 = y 100-340)
    fenceV(connRX, upTopY + CELL_SIZE, loTopY);
    // Connector left fence       (col 16, rows 10-17 = y 200-340)
    fenceV(connLX, upBotY + CELL_SIZE, loTopY);
    // Lower segment top fence    (row 18, cols 20-31 = x 400-620)
    fenceH(connRX, CANVAS_W - CELL_SIZE, loTopY);
    // Lower segment bottom fence (row 22, cols 16-31 = x 320-620)
    fenceH(connLX, CANVAS_W - CELL_SIZE, loBotY);
    // Lower segment left fence   (col 16, rows 19-21 = y 380-420)
    fenceV(connLX, loTopY + CELL_SIZE, loBotY);

    // ── 7. ⚠️ WARNING SIGNS at open cliff edges ────────────────────────
    const warnSign = (wx: number, wy: number) => {
      // Yellow exclamation triangle
      g.fillStyle(0xffcc00, 0.88);
      g.fillTriangle(wx, wy - 11, wx - 9, wy + 6, wx + 9, wy + 6);
      g.fillStyle(0x1a1500, 0.8);
      g.fillRect(wx - 1.5, wy - 7, 3, 8);
      g.fillCircle(wx, wy + 3.5, 1.8);
    };
    // Open cliff edge at bottom-right of upper segment (row 9, cols 16-20)
    warnSign(17 * CELL_SIZE + CELL_SIZE / 2, upBotY + 14);
    warnSign(19 * CELL_SIZE + CELL_SIZE / 2, upBotY + 14);
    // Open left edge beside connector
    warnSign(CELL_SIZE / 2, (upBotY + loTopY) / 2);

    // ── 8. TREES flanking path ─────────────────────────────────────────
    const tree = (tx: number, ty: number, s: number) => {
      g.fillStyle(0x5c3317);
      g.fillRect(tx - Math.round(3 * s), ty, Math.round(6 * s), Math.round(22 * s));
      g.fillStyle(0x1b5c0a);
      g.fillEllipse(tx, ty - Math.round(8 * s), Math.round(36 * s), Math.round(26 * s));
      g.fillStyle(0x2d8a14, 0.62);
      g.fillEllipse(tx, ty - Math.round(15 * s), Math.round(24 * s), Math.round(16 * s));
      g.fillStyle(0x48a820, 0.35);
      g.fillEllipse(tx - Math.round(5 * s), ty - Math.round(17 * s), Math.round(11 * s), Math.round(8 * s));
    };
    // Left of start (above upper segment)
    tree(12, 62, 0.70);
    tree(28, 50, 0.56);
    // Right side above upper segment (before goal area)
    tree(428, 56, 0.62);
    tree(446, 44, 0.50);
    // Near goal (lower segment right side)
    tree(616, loTopY + 8, 0.82);
    tree(598, loTopY + 20, 0.65);

    // ── 9. START FLAG (col 2, row 6 → x=50, y=130) ───────────────────
    const sfx = 2 * CELL_SIZE + CELL_SIZE / 2;
    const sfy = uCY;
    g.fillStyle(0x3a2010);
    g.fillRect(sfx - 1, sfy - 22, 2, 26);
    g.fillStyle(0x44cc22);
    g.fillTriangle(sfx + 1, sfy - 22, sfx + 16, sfy - 15, sfx + 1, sfy - 9);
    // Right-pointing arrow guide
    g.fillStyle(0xffdd00, 0.80);
    g.fillRect(sfx + 18, sfy - 3, 15, 5);
    g.fillTriangle(sfx + 33, sfy - 7, sfx + 42, sfy - 1, sfx + 33, sfy + 5);
  }

  // ── Level 3: Bamboo Bridge Maze — dark abyss with bridge planks ──────────
  private drawLevel3Background(): void {
    const g  = this.bgGraphics;
    const CS = CELL_SIZE;

    // 1. Very dark void/abyss background
    g.fillStyle(0x060810);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle blue-black gradient bands
    g.fillStyle(0x080c18, 0.5);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H / 2);
    g.fillStyle(0x040608, 0.5);
    g.fillRect(0, CANVAS_H / 2, CANVAS_W, CANVAS_H / 2);

    // 2. Abyss depth effect — faint vertical streak lines
    g.lineStyle(1, 0x0a1428, 0.18);
    for (let x = 10; x < CANVAS_W; x += 22) {
      g.beginPath();
      g.moveTo(x + Math.sin(x * 0.05) * 3, 0);
      g.lineTo(x + Math.sin(x * 0.05 + 2) * 3, CANVAS_H);
      g.strokePath();
    }

    // 3. Bridge planks — helper lambda
    const drawBridgeCells = (cells: Array<[number, number]>) => {
      for (const [col, row] of cells) {
        const px = col * CS;
        const py = row * CS;
        // Dark wood base
        g.fillStyle(0x6B3F1A);
        g.fillRect(px, py, CS, CS);
        // Lighter stripe in middle
        g.fillStyle(0x8B5E3C, 0.7);
        g.fillRect(px, py + CS * 0.35, CS, CS * 0.3);
        // Plank crack lines every 4px
        g.lineStyle(1, 0x3d2007, 0.55);
        for (let cx = px + 4; cx < px + CS; cx += 4) {
          g.beginPath(); g.moveTo(cx, py); g.lineTo(cx, py + CS); g.strokePath();
        }
      }
    };

    // Draw all bridge segments
    // Bridge 1: rows 4-5, cols 1-19
    const bridge1Cells: Array<[number, number]> = [];
    for (let c = 1; c <= 19; c++) for (let r = 4; r <= 5; r++) bridge1Cells.push([c, r]);
    drawBridgeCells(bridge1Cells);

    // Connector 1: cols 11-12, rows 6-12
    const conn1Cells: Array<[number, number]> = [];
    for (let c = 11; c <= 12; c++) for (let r = 6; r <= 12; r++) conn1Cells.push([c, r]);
    drawBridgeCells(conn1Cells);

    // Bridge 2: rows 13-14, cols 8-22
    const bridge2Cells: Array<[number, number]> = [];
    for (let c = 8; c <= 22; c++) for (let r = 13; r <= 14; r++) bridge2Cells.push([c, r]);
    drawBridgeCells(bridge2Cells);

    // Dead-end branch: cols 20-21, rows 6-12
    const deadBranchCells: Array<[number, number]> = [];
    for (let c = 20; c <= 21; c++) for (let r = 6; r <= 12; r++) deadBranchCells.push([c, r]);
    drawBridgeCells(deadBranchCells);

    // Bridge 4: rows 4-5, cols 18-29
    const bridge4Cells: Array<[number, number]> = [];
    for (let c = 18; c <= 29; c++) for (let r = 4; r <= 5; r++) bridge4Cells.push([c, r]);
    drawBridgeCells(bridge4Cells);

    // Connector 2: cols 14-15, rows 15-18
    const conn2Cells: Array<[number, number]> = [];
    for (let c = 14; c <= 15; c++) for (let r = 15; r <= 18; r++) conn2Cells.push([c, r]);
    drawBridgeCells(conn2Cells);

    // Bridge 3: rows 19-20, cols 12-29
    const bridge3Cells: Array<[number, number]> = [];
    for (let c = 12; c <= 29; c++) for (let r = 19; r <= 20; r++) bridge3Cells.push([c, r]);
    drawBridgeCells(bridge3Cells);

    // 4. Bridge rope edges — dark rope-brown lines along bridge edges
    g.lineStyle(2, 0x4a2d0a, 0.9);
    // Bridge 1 top/bottom
    g.beginPath(); g.moveTo(1*CS, 4*CS); g.lineTo(20*CS, 4*CS); g.strokePath();
    g.beginPath(); g.moveTo(1*CS, 6*CS); g.lineTo(20*CS, 6*CS); g.strokePath();
    // Connector 1 left/right
    g.beginPath(); g.moveTo(11*CS, 6*CS); g.lineTo(11*CS, 13*CS); g.strokePath();
    g.beginPath(); g.moveTo(13*CS, 6*CS); g.lineTo(13*CS, 13*CS); g.strokePath();
    // Bridge 2 top/bottom
    g.beginPath(); g.moveTo(8*CS, 13*CS); g.lineTo(23*CS, 13*CS); g.strokePath();
    g.beginPath(); g.moveTo(8*CS, 15*CS); g.lineTo(23*CS, 15*CS); g.strokePath();
    // Dead-end branch left/right
    g.beginPath(); g.moveTo(20*CS, 6*CS); g.lineTo(20*CS, 13*CS); g.strokePath();
    g.beginPath(); g.moveTo(22*CS, 6*CS); g.lineTo(22*CS, 13*CS); g.strokePath();
    // Bridge 4 top/bottom
    g.beginPath(); g.moveTo(18*CS, 4*CS); g.lineTo(30*CS, 4*CS); g.strokePath();
    g.beginPath(); g.moveTo(18*CS, 6*CS); g.lineTo(30*CS, 6*CS); g.strokePath();
    // Connector 2 left/right
    g.beginPath(); g.moveTo(14*CS, 15*CS); g.lineTo(14*CS, 19*CS); g.strokePath();
    g.beginPath(); g.moveTo(16*CS, 15*CS); g.lineTo(16*CS, 19*CS); g.strokePath();
    // Bridge 3 top/bottom
    g.beginPath(); g.moveTo(12*CS, 19*CS); g.lineTo(30*CS, 19*CS); g.strokePath();
    g.beginPath(); g.moveTo(12*CS, 21*CS); g.lineTo(30*CS, 21*CS); g.strokePath();

    // 5. Bamboo joints — small circles every 6 cols along bridge segments
    g.fillStyle(0x5C8A00, 1.0);
    for (let c = 1; c <= 19; c += 6) { g.fillCircle(c*CS + CS/2, 4*CS, 3); g.fillCircle(c*CS + CS/2, 6*CS, 3); }
    for (let c = 8; c <= 22; c += 6) { g.fillCircle(c*CS + CS/2, 13*CS, 3); g.fillCircle(c*CS + CS/2, 15*CS, 3); }
    for (let c = 18; c <= 29; c += 6) { g.fillCircle(c*CS + CS/2, 4*CS, 3); g.fillCircle(c*CS + CS/2, 6*CS, 3); }
    for (let c = 12; c <= 29; c += 6) { g.fillCircle(c*CS + CS/2, 19*CS, 3); g.fillCircle(c*CS + CS/2, 21*CS, 3); }

    // 6. Foggy abyss mist — two slow-drifting fog layers
    const f1 = (this.fogScrollMs / 16) % CANVAS_W;
    const f2 = (this.fogScrollMs / 11) % CANVAS_W;
    // Layer 1: drifting left
    g.fillStyle(0x081428, 0.35);
    g.fillRect(-f1,          80, CANVAS_W * 1.5, 40);
    g.fillRect(-f1 + CANVAS_W, 80, CANVAS_W * 1.5, 40);
    g.fillRect(-f1,          220, CANVAS_W * 1.5, 35);
    g.fillRect(-f1 + CANVAS_W, 220, CANVAS_W * 1.5, 35);
    g.fillRect(-f1,          360, CANVAS_W * 1.5, 30);
    g.fillRect(-f1 + CANVAS_W, 360, CANVAS_W * 1.5, 30);
    // Layer 2: drifting right
    g.fillStyle(0x0a1f3c, 0.18);
    g.fillRect(f2,           130, CANVAS_W * 1.5, 30);
    g.fillRect(f2 - CANVAS_W, 130, CANVAS_W * 1.5, 30);
    g.fillRect(f2,           290, CANVAS_W * 1.5, 25);
    g.fillRect(f2 - CANVAS_W, 290, CANVAS_W * 1.5, 25);
    g.fillRect(f2,           420, CANVAS_W * 1.5, 28);
    g.fillRect(f2 - CANVAS_W, 420, CANVAS_W * 1.5, 28);

    // 7. Glowing fruit trail — if pathGlowMs > 0, soft green glow near glory
    if (this.pathGlowMs > 0) {
      const glowAlpha = (this.pathGlowMs / 3000) * 0.45;
      const gc = this.gloryCell();
      // Highlight nearby bridge path cells
      g.fillStyle(0x44ff88, glowAlpha);
      for (let dc = -3; dc <= 3; dc++) {
        for (let dr = -2; dr <= 2; dr++) {
          const nc = gc.x + dc;
          const nr = gc.y + dr;
          if (nc >= 0 && nc < 32 && nr >= 0 && nr < 24) {
            g.fillRect(nc * CS + 1, nr * CS + 1, CS - 2, CS - 2);
          }
        }
      }
    }

    // 8. Ambient ember sparks — faint orange-red dots pulsing at abyss depth
    const t = Date.now() * 0.001;
    const embers: Array<[number, number]> = [
      [120, 380], [280, 430], [450, 400], [580, 460],
    ];
    for (let i = 0; i < embers.length; i++) {
      const pulse = 0.3 + 0.3 * Math.sin(t * 1.2 + i * 1.7);
      g.fillStyle(0xff4400, pulse * 0.6);
      g.fillCircle(embers[i][0], embers[i][1], 3 + Math.sin(t + i) * 1.5);
    }

    // Draw unstable/collapsed cell visual overlays
    for (const uc of this.unstableCells) {
      const px = uc.col * CS;
      const py = uc.row * CS;
      if (uc.phase === 'cracking') {
        g.fillStyle(0xff8800, 0.45);
        g.fillRect(px, py, CS, CS);
        // crack lines
        g.lineStyle(1, 0xff4400, 0.7);
        g.beginPath(); g.moveTo(px + 3, py + 3); g.lineTo(px + CS - 3, py + CS - 3); g.strokePath();
        g.beginPath(); g.moveTo(px + CS - 3, py + 3); g.lineTo(px + 3, py + CS - 3); g.strokePath();
      } else if (uc.phase === 'collapsed') {
        g.fillStyle(0x000000, 0.85);
        g.fillRect(px, py, CS, CS);
        g.fillStyle(0x1a0a00, 0.5);
        g.fillCircle(px + CS/2, py + CS/2, CS/3);
      } else if (uc.phase === 'recovering') {
        g.fillStyle(0x3d2007, 0.6);
        g.fillRect(px, py, CS, CS);
      }
    }
  }

  // ── Level 2: Edge of Survival — cold mountain cliff background ─────────────
  private drawLevel2Background(): void {
    const g  = this.bgGraphics;
    const CS = CELL_SIZE;

    // Key pixel boundaries matching the Level 2 S-curve wall layout
    const trailTopY =  4 * CS;   //  80 — top wall of both upper corridors
    const trailBotY =  7 * CS;   // 140 — bottom wall of upper corridors
    const conn1LX   = 11 * CS;   // 220 — left wall of connector 1
    const conn1RX   = 16 * CS;   // 320 — right wall of connector 1
    const midTopY   = 14 * CS;   // 280 — top wall of middle trail
    const midBotY   = 17 * CS;   // 340 — bottom wall of middle trail
    const conn2LX   = 19 * CS;   // 380 — left wall of connector 2
    const conn2RX   = 23 * CS;   // 460 — right wall of connector 2

    // ── 1. Full canvas base — deep abyss void ────────────────────────
    g.fillStyle(0x07090e);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ── 2. Cold night sky (rows 0–4) ─────────────────────────────────
    g.fillStyle(0x0d1b30);
    g.fillRect(0, 0, CANVAS_W, trailTopY);
    g.fillStyle(0x162540, 0.65);
    g.fillRect(0, 0, CANVAS_W, trailTopY * 0.5);
    // Cold horizon glow — faint amber where cliff meets sky
    g.fillStyle(0x6a2e0a, 0.22);
    g.fillRect(0, trailTopY - 22, CANVAS_W, 22);
    g.fillStyle(0x3a1608, 0.13);
    g.fillRect(0, trailTopY - 38, CANVAS_W, 22);

    // Stars — deterministic positions
    g.fillStyle(0xccd8ee, 0.88);
    for (const [sx, sy, big] of [
      [18,7,0],[55,14,0],[102,5,1],[148,18,0],[196,9,1],[242,3,0],[288,16,0],
      [334,7,1],[378,20,0],[424,4,0],[468,13,1],[512,8,0],[558,17,0],[602,5,1],
      [30,39,0],[88,47,1],[158,32,0],[224,51,0],[298,37,1],[362,55,0],[430,41,0],
      [496,57,1],[560,35,0],[618,49,0],[72,61,0],[168,67,1],[260,57,0],[540,59,0],
    ] as [number, number, number][]) {
      g.fillCircle(sx, sy, big ? 1.8 : 1.1);
    }
    // Bright foreground stars with tiny halo
    g.fillStyle(0xffffff, 0.95);
    for (const [sx, sy] of [[136, 23], [410, 29], [570, 11]] as [number, number][]) {
      g.fillCircle(sx, sy, 2.2);
      g.fillStyle(0xccd8ee, 0.10); g.fillCircle(sx, sy, 5); g.fillStyle(0xffffff, 0.95);
    }

    // Crescent moon — upper-right
    const moonX = 556, moonY = 33;
    g.fillStyle(0xd4c490, 0.90); g.fillCircle(moonX, moonY, 13);
    g.fillStyle(0x0d1b30, 1.0);  g.fillCircle(moonX + 7, moonY - 3, 11);  // crescent cut
    g.fillStyle(0xd4c490, 0.07); g.fillCircle(moonX, moonY, 26);
    g.fillStyle(0xd4c490, 0.04); g.fillCircle(moonX, moonY, 40);

    // ── 3. Jagged mountain silhouettes ────────────────────────────────
    const groundY = trailTopY + 8;
    g.fillStyle(0x111a26, 0.95);
    for (const [x1, xp, yp, x2] of [
      [0,   60,  trailTopY - 34, 118],
      [78,  154, trailTopY - 54, 228],
      [182, 264, trailTopY - 46, 342],
      [272, 358, trailTopY - 62, 444],
      [376, 458, trailTopY - 38, 538],
      [472, 548, trailTopY - 50, 642],
    ] as [number, number, number, number][]) {
      g.fillTriangle(x1, groundY, xp, yp, x2, groundY);
    }
    // Snow caps on two tallest peaks
    g.fillStyle(0xdde8f4, 0.26);
    g.fillTriangle(222, trailTopY - 22, 264, trailTopY - 54, 306, trailTopY - 20);
    g.fillTriangle(318, trailTopY - 30, 358, trailTopY - 62, 398, trailTopY - 28);

    // ── 4. Rocky cliff face (non-trail zones) ─────────────────────────
    // Zone A: left of conn1LX, between upper and middle trail
    g.fillStyle(0x1c1810); g.fillRect(0,       trailBotY, conn1LX,             midBotY - trailBotY);
    // Zone B: between conn1RX and conn2LX (gap between the two connectors)
    g.fillStyle(0x1a160e); g.fillRect(conn1RX,  trailBotY, conn2LX - conn1RX,  midBotY - trailBotY);
    // Zone C: right of conn2RX, between upper and middle trail
    g.fillStyle(0x1c1810); g.fillRect(conn2RX,  trailBotY, CANVAS_W - conn2RX, midBotY - trailBotY);

    // Rock strata — horizontal stress cracks
    g.fillStyle(0x0e0b07, 0.55);
    for (let ry = trailBotY + 12; ry < midBotY - 5; ry += 22) {
      const t = (ry - trailBotY) / (midBotY - trailBotY);
      g.fillRect(0,            ry, conn1LX * (0.40 + 0.48 * Math.sin(t * 6.3 + 0.3)), 4);
      g.fillRect(conn1RX + 8,  ry, (conn2LX - conn1RX) * (0.30 + 0.45 * Math.sin(t * 5.1 + 1.1)), 3);
      g.fillRect(conn2RX + 6,  ry, (CANVAS_W - conn2RX) * (0.38 + 0.40 * Math.sin(t * 5.7 + 0.7)), 4);
    }
    // Lighter strata glints (cold grey)
    g.fillStyle(0x383028, 0.17);
    for (let ry = trailBotY + 4; ry < midBotY - 5; ry += 22) {
      g.fillRect(4, ry, conn1LX * 0.52, 2);
      g.fillRect(conn1RX + 12, ry, (conn2LX - conn1RX) * 0.38, 2);
      g.fillRect(conn2RX + 10, ry, (CANVAS_W - conn2RX) * 0.38, 2);
    }
    // Deep crevices
    g.fillStyle(0x060504, 0.82);
    for (const [cx, cy, cw] of [
      [22,158,46],[90,174,34],[154,192,50],[30,212,42],[112,230,36],[160,250,52],
      [62,268,40],[170,284,34],[192,302,46],[342,162,38],[402,179,32],[460,198,42],
      [348,217,50],[420,236,34],[362,254,44],[448,272,38],[488,165,36],[544,182,43],
      [600,201,32],[512,222,48],[572,242,36],[506,264,40],[562,287,34],
    ] as [number, number, number][]) {
      g.fillRect(cx, cy, cw, 3);
    }

    // ── 5. Deep abyss below middle trail ─────────────────────────────
    g.fillStyle(0x130f08, 0.94); g.fillRect(0, midBotY,      CANVAS_W, 26);
    g.fillStyle(0x0b0906, 0.97); g.fillRect(0, midBotY + 22, CANVAS_W, 36);
    g.fillStyle(0x060504, 1.00); g.fillRect(0, midBotY + 52, CANVAS_W, 48);
    g.fillStyle(0x000000);       g.fillRect(0, midBotY + 90, CANVAS_W, CANVAS_H - midBotY - 90);

    // ── 6. Animated fog drifting through the abyss ────────────────────
    // Three layers at different speeds for parallax depth
    const f1 = (this.fogScrollMs / 14) % CANVAS_W;
    g.fillStyle(0x283040, 0.11);
    for (let fx = -CANVAS_W + f1; fx < CANVAS_W + 10; fx += CANVAS_W * 0.62) {
      g.fillEllipse(fx + CANVAS_W * 0.32, midBotY + 26, CANVAS_W * 0.68, 36);
    }
    const f2 = (this.fogScrollMs / 9) % CANVAS_W;
    g.fillStyle(0x1e2836, 0.09);
    for (let fx = -CANVAS_W + f2; fx < CANVAS_W + 10; fx += CANVAS_W * 0.50) {
      g.fillEllipse(fx + CANVAS_W * 0.25, midBotY + 58, CANVAS_W * 0.54, 28);
    }
    const f3 = (this.fogScrollMs / 6) % CANVAS_W;
    g.fillStyle(0x161e2c, 0.07);
    for (let fx = -CANVAS_W + f3; fx < CANVAS_W + 10; fx += CANVAS_W * 0.38) {
      g.fillEllipse(fx + CANVAS_W * 0.19, midBotY + 84, CANVAS_W * 0.42, 20);
    }

    // ── 7. Stone path fills (weathered dark ledge) ───────────────────
    const stone = 0x4e4438;
    g.fillStyle(stone);
    // Upper-left corridor (including wall row 4)
    g.fillRect(0,       trailTopY, conn1RX,             trailBotY - trailTopY);
    // Connector 1 vertical strip (down from upper trail to middle trail)
    g.fillRect(conn1LX, trailTopY, conn1RX - conn1LX,   midBotY - trailTopY);
    // Middle trail
    g.fillRect(conn1LX, midTopY,   conn2RX - conn1LX,   midBotY - midTopY);
    // Connector 2 vertical strip (back up to upper trail level)
    g.fillRect(conn2LX, trailTopY, conn2RX - conn2LX,   midBotY - trailTopY);
    // Upper-right corridor
    g.fillRect(conn2LX, trailTopY, CANVAS_W - conn2LX,  trailBotY - trailTopY);

    // Stone surface grain
    g.fillStyle(0x3a3028, 0.18);
    for (let x = 10; x < conn1RX - 10; x += 44) {
      g.fillRect(x, trailTopY + 4, 28, trailBotY - trailTopY - 8);
    }
    for (let x = conn2LX + 10; x < CANVAS_W - 10; x += 44) {
      g.fillRect(x, trailTopY + 4, 28, trailBotY - trailTopY - 8);
    }
    for (let x = conn1LX + 8; x < conn2RX - 8; x += 40) {
      g.fillRect(x, midTopY + 4, 24, midBotY - midTopY - 8);
    }
    // Cold frost glint along top edge of each ledge
    g.fillStyle(0x7a7262, 0.30);
    g.fillRect(0,       trailTopY, conn1RX,            3);
    g.fillRect(conn2LX, trailTopY, CANVAS_W - conn2LX, 3);
    g.fillRect(conn1LX, midTopY,   conn2RX - conn1LX,  3);
    // Ledge drop shadow (bottom edge)
    g.fillStyle(0x242018, 0.48);
    g.fillRect(0,       trailBotY - 6, conn1LX,            6);
    g.fillRect(conn2LX, trailBotY - 6, CANVAS_W - conn2LX, 6);
    g.fillRect(conn1LX, midBotY   - 6, conn2RX - conn1LX,  6);

    // ── 8. Cliff-edge danger lines — pulsing orange glow ─────────────
    const edgePulse = 0.20 + 0.14 * Math.sin(Date.now() / 480);
    g.lineStyle(2, 0xff6600, edgePulse);
    g.beginPath(); g.moveTo(0, trailBotY);       g.lineTo(conn1LX, trailBotY); g.strokePath();
    g.beginPath(); g.moveTo(conn2LX, trailBotY); g.lineTo(CANVAS_W, trailBotY); g.strokePath();
    g.lineStyle(2, 0xff3300, edgePulse + 0.10);
    g.beginPath(); g.moveTo(conn1LX, midBotY);   g.lineTo(conn2RX, midBotY); g.strokePath();

    // ── 9. Wind particles — drifting dust/ice crystals ────────────────
    for (const p of this.windParticles) {
      g.fillStyle(0xb0c4d8, p.alpha);
      g.fillEllipse(p.x, p.y, p.size * 2.8, p.size);
    }

    // ── 10. Falling rocks — break off cliff into abyss ────────────────
    for (const r of this.fallingRocks) {
      g.fillStyle(0x6b5c45, r.alpha * 0.8);
      g.fillEllipse(r.x, r.y, r.size * 1.6, r.size);
      g.fillStyle(0x998870, r.alpha * 0.45);
      g.fillEllipse(r.x - r.size * 0.3, r.y - r.size * 0.2, r.size * 0.8, r.size * 0.5);
    }

    // ── 11. Edge-danger ledge cells — cracked amber glow at precarious edges ─
    const edgeCellPulse = 0.18 + 0.08 * Math.sin(Date.now() / 550);
    for (const [ec, er] of VenomArenaScene.EDGE_DANGER_CELLS) {
      const ex = ec * CELL_SIZE;
      const ey = er * CELL_SIZE;
      // Cracked ground fill
      g.fillStyle(0xcc5500, edgeCellPulse * 0.55);
      g.fillRect(ex, ey, CELL_SIZE, CELL_SIZE);
      // Crack lines
      g.lineStyle(1, 0xff8800, edgeCellPulse * 0.7);
      g.beginPath(); g.moveTo(ex + 4, ey + 3); g.lineTo(ex + 10, ey + 12); g.lineTo(ex + 16, ey + 8); g.strokePath();
      g.beginPath(); g.moveTo(ex + 12, ey + 4); g.lineTo(ex + 8, ey + 16); g.strokePath();
    }

    // ── 12. Unstable path cells — cracking / collapsed visual ────────────
    const now = Date.now();
    for (const uc of this.unstableCells) {
      if (uc.phase === 'stable') continue;
      const ux = uc.col * CELL_SIZE;
      const uy = uc.row * CELL_SIZE;
      if (uc.phase === 'cracking') {
        // Flickering yellow-brown crack warning
        const cPulse = 0.4 + 0.3 * Math.sin(now / 90);
        g.fillStyle(0x8b5a00, cPulse * 0.7);
        g.fillRect(ux, uy, CELL_SIZE, CELL_SIZE);
        g.lineStyle(1, 0xffaa00, cPulse);
        // Three crack lines radiating outward
        g.beginPath(); g.moveTo(ux + 10, uy + 2);  g.lineTo(ux + 5,  uy + 18); g.strokePath();
        g.beginPath(); g.moveTo(ux + 10, uy + 2);  g.lineTo(ux + 17, uy + 14); g.strokePath();
        g.beginPath(); g.moveTo(ux + 4,  uy + 10); g.lineTo(ux + 16, uy + 7);  g.strokePath();
      } else if (uc.phase === 'collapsed') {
        // Dark pit — fallen section of trail
        g.fillStyle(0x100a04, 0.92);
        g.fillRect(ux, uy, CELL_SIZE, CELL_SIZE);
        // Red-orange glow at the edges of the pit
        const pitPulse = 0.22 + 0.12 * Math.sin(now / 200);
        g.fillStyle(0xff3300, pitPulse * 0.5);
        g.fillRect(ux, uy, CELL_SIZE, 2);
        g.fillRect(ux, uy + CELL_SIZE - 2, CELL_SIZE, 2);
        g.fillRect(ux, uy, 2, CELL_SIZE);
        g.fillRect(ux + CELL_SIZE - 2, uy, 2, CELL_SIZE);
      } else if (uc.phase === 'recovering') {
        // Fading back — light grey dust
        g.fillStyle(0x9e8d6a, 0.35);
        g.fillRect(ux, uy, CELL_SIZE, CELL_SIZE);
      }
    }

    // ── 13. Direction guide dots along trail centre ───────────────────
    const ucY  = (trailTopY + trailBotY) / 2;
    const mcY  = (midTopY   + midBotY)   / 2;
    const c1cX = (conn1LX   + conn1RX)   / 2;
    const c2cX = (conn2LX   + conn2RX)   / 2;
    g.fillStyle(0xc07830, 0.36);
    for (let dx = 30;        dx < conn1LX - 16;   dx += 22) g.fillCircle(dx,    ucY,  2.0);
    for (let dy = trailBotY + 18; dy < midTopY - 12; dy += 22) g.fillCircle(c1cX, dy,   2.0);
    for (let dx = conn1LX + 18; dx < conn2LX - 12;   dx += 22) g.fillCircle(dx,   mcY,  2.0);
    for (let dy = midTopY - 12; dy > trailBotY + 12;  dy -= 22) g.fillCircle(c2cX, dy,   2.0);
    for (let dx = conn2LX + 18; dx < CANVAS_W - 22;   dx += 22) g.fillCircle(dx,   ucY,  2.0);
  }

  private drawBackground(): void {
    // House layout uses its own interior background
    if (LEVEL_CONFIGS[gameLevel - 1].houseLayout) { this.drawHouseBackground(); return; }
    // Level 1 (Mountain Path) uses its own clean visual design — skip if replaced
    if (gameLevel === 1 && !LEVEL_CONFIGS[0].houseLayout) { this.drawLevel1Background(); return; }
    // Level 2: "Edge of Survival" — cold mountain cliff, fog abyss, wind
    if (gameLevel === 2) { this.drawLevel2Background(); return; }
    // Level 3: "Bamboo Bridge Maze" — dark abyss, bamboo bridges, fog
    if (gameLevel === 3) { this.drawLevel3Background(); return; }

    // ── Blue sky (top portion) ────────────────────────────────────────
    this.bgGraphics.fillStyle(0x3a7fcf);
    this.bgGraphics.fillRect(0, 0, CANVAS_W, 70);
    this.bgGraphics.fillStyle(0x5899de);
    this.bgGraphics.fillRect(0, 70, CANVAS_W, 60);
    this.bgGraphics.fillStyle(0x87ceeb);
    this.bgGraphics.fillRect(0, 130, CANVAS_W, 58);

    // Clouds
    const drawCloud = (cx: number, cy: number, sc: number) => {
      this.bgGraphics.fillStyle(0xffffff, 0.88);
      this.bgGraphics.fillEllipse(cx, cy, 64 * sc, 28 * sc);
      this.bgGraphics.fillEllipse(cx - 22 * sc, cy + 7 * sc, 40 * sc, 22 * sc);
      this.bgGraphics.fillEllipse(cx + 22 * sc, cy + 6 * sc, 44 * sc, 24 * sc);
      this.bgGraphics.fillEllipse(cx, cy - 10 * sc, 36 * sc, 20 * sc);
    };
    drawCloud(100, 32, 0.75);
    drawCloud(300, 20, 1.0);
    drawCloud(500, 40, 0.8);
    drawCloud(190, 58, 0.6);
    drawCloud(445, 58, 0.7);

    // ── Rolling hills background ──────────────────────────────────────
    this.bgGraphics.fillStyle(0x3d8030);
    for (let i = 0; i < 7; i++) {
      this.bgGraphics.fillEllipse(i * 115 - 20, 170, 190, 82);
    }
    this.bgGraphics.fillStyle(0x52a838, 0.45);
    for (let i = 0; i < 7; i++) {
      this.bgGraphics.fillEllipse(i * 115 - 30, 158, 120, 45);
    }

    // ── Green ground (below horizon) ──────────────────────────────────
    this.bgGraphics.fillStyle(0x2d5a1b);
    this.bgGraphics.fillRect(0, 185, CANVAS_W, CANVAS_H - 185);

    // ── Background trees (distant silhouette) ─────────────────────────
    this.bgGraphics.fillStyle(0x1e4a10, 0.8);
    for (let i = 0; i < 9; i++) {
      const bx = 50 + i * 70;
      this.bgGraphics.fillEllipse(bx, 174, 46, 28);
      this.bgGraphics.fillRect(bx - 3, 180, 6, 20);
    }

    // Helper: draw a real-looking foreground tree
    const drawTree = (tx: number, ty: number, sz: number) => {
      this.bgGraphics.fillStyle(0x5c3317);
      this.bgGraphics.fillRect(tx - Math.round(4 * sz), ty, Math.round(8 * sz), Math.round(28 * sz));
      this.bgGraphics.fillStyle(0x7a4a20, 0.45);
      this.bgGraphics.fillRect(tx - Math.round(4 * sz), ty, Math.round(3 * sz), Math.round(28 * sz));
      const fc: [number, number, number] = [0x1a5c0a, 0x236e10, 0x2d8a14];
      for (let l = 0; l < 3; l++) {
        this.bgGraphics.fillStyle(fc[l]);
        this.bgGraphics.fillEllipse(
          tx, ty - Math.round((12 + l * 18) * sz),
          Math.round((52 - l * 10) * sz), Math.round((34 - l * 6) * sz)
        );
      }
      this.bgGraphics.fillStyle(0x3cb818, 0.3);
      this.bgGraphics.fillEllipse(tx - Math.round(7 * sz), ty - Math.round(30 * sz), Math.round(20 * sz), Math.round(14 * sz));
    };

    // Foreground trees — left edge
    drawTree(18, 310, 1.0);
    drawTree(46, 278, 0.85);
    drawTree(20, 358, 1.1);
    // Foreground trees — right edge
    drawTree(624, 295, 0.95);
    drawTree(604, 335, 1.05);
    drawTree(618, 358, 0.9);
    // Trees between path bottom and river (both sides)
    drawTree(28, 390, 0.62);
    drawTree(50, 378, 0.52);
    drawTree(612, 382, 0.58);
    drawTree(594, 374, 0.68);

    // ── Curved winding dirt path ──────────────────────────────────────
    const numPts = 80;
    const pathTopPts: { x: number; y: number }[] = [];
    const pathBotPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      const px = t * CANVAS_W;
      const wave = Math.sin(t * Math.PI * 2.2) * 18 + Math.sin(t * Math.PI * 0.9 + 0.5) * 10;
      const midY = 240 + wave;
      pathTopPts.push({ x: px, y: midY - 40 });
      pathBotPts.push({ x: px, y: midY + 40 });
    }
    const pathPoly = [...pathTopPts, ...[...pathBotPts].reverse()];
    this.bgGraphics.fillStyle(0x8b6914, 0.85);
    this.bgGraphics.fillPoints(pathPoly as Phaser.Types.Math.Vector2Like[], true);
    // Center highlight stripe
    this.bgGraphics.fillStyle(0xa07840, 0.28);
    for (let i = 0; i <= numPts; i++) {
      const t = i / numPts;
      const px = t * CANVAS_W;
      const wave = Math.sin(t * Math.PI * 2.2) * 18 + Math.sin(t * Math.PI * 0.9 + 0.5) * 10;
      this.bgGraphics.fillEllipse(px, 240 + wave, 28, 10);
    }
    // Path pebbles
    this.bgGraphics.fillStyle(0x6b5020, 0.5);
    for (let i = 0; i < 30; i++) {
      const t = i * 0.034 + 0.01;
      const px = t * CANVAS_W;
      const wave = Math.sin(t * Math.PI * 2.2) * 18 + Math.sin(t * Math.PI * 0.9 + 0.5) * 10;
      this.bgGraphics.fillCircle(px, 240 + wave + (i % 3 - 1) * 18, 2.5);
    }

    // ── Grass tufts (avoiding path + river) ──────────────────────────
    this.bgGraphics.fillStyle(0x3d8c28, 0.6);
    for (let i = 0; i < 35; i++) {
      const gx = (i * 47 + 13) % CANVAS_W;
      const gy = 195 + (i * 31 + 7) % 200;
      if (gy > 420) continue;
      const waveAtX = Math.sin((gx / CANVAS_W) * Math.PI * 2.2) * 18 + Math.sin((gx / CANVAS_W) * Math.PI * 0.9 + 0.5) * 10;
      const pathMidAtX = 240 + waveAtX;
      if (gy > pathMidAtX - 46 && gy < pathMidAtX + 46) continue;
      this.bgGraphics.fillEllipse(gx, gy, 8, 4);
    }

    // Terrain rocks (decorative, skip river zone)
    this.bgGraphics.fillStyle(0x6b5744);
    for (const rock of TERRAIN_ROCKS) {
      if (rock.y > 422) continue;
      this.bgGraphics.fillEllipse(rock.x, rock.y, rock.rw, rock.rh);
    }

    // ── Flowers beside the river / fence ─────────────────────────────
    const flowerColors = [0xff5a8a, 0xffdd00, 0xff9900, 0xffffff, 0xff4466, 0xcc44ff];
    const flowerData = [
      { x: 28, y: 407 }, { x: 68, y: 414 }, { x: 112, y: 406 },
      { x: 168, y: 412 }, { x: 218, y: 407 }, { x: 265, y: 414 },
      { x: 312, y: 403 }, { x: 360, y: 412 }, { x: 408, y: 407 },
      { x: 455, y: 415 }, { x: 500, y: 404 }, { x: 548, y: 411 },
      { x: 590, y: 406 }, { x: 628, y: 414 },
      { x: 48, y: 422 }, { x: 138, y: 420 }, { x: 244, y: 423 },
      { x: 338, y: 419 }, { x: 430, y: 422 }, { x: 520, y: 420 }, { x: 612, y: 421 },
    ];
    for (let fi = 0; fi < flowerData.length; fi++) {
      const fd = flowerData[fi];
      const fc = flowerColors[fi % flowerColors.length];
      // Stem
      this.bgGraphics.fillStyle(0x2d8a1c);
      this.bgGraphics.fillRect(fd.x - 1, fd.y, 2, 9);
      // Petals
      this.bgGraphics.fillStyle(fc, 0.92);
      this.bgGraphics.fillEllipse(fd.x, fd.y - 2, 9, 5);
      this.bgGraphics.fillEllipse(fd.x - 3, fd.y + 2, 5, 8);
      this.bgGraphics.fillEllipse(fd.x + 3, fd.y + 2, 5, 8);
      // Center
      this.bgGraphics.fillStyle(0xffff88);
      this.bgGraphics.fillCircle(fd.x, fd.y + 2, 1.8);
    }

    // ── River at the bottom ───────────────────────────────────────────
    const riverY = 432;
    const riverH = 48;
    this.bgGraphics.fillStyle(0x1565c0);
    this.bgGraphics.fillRect(0, riverY, CANVAS_W, riverH);
    this.bgGraphics.fillStyle(0x1e88e5, 0.7);
    this.bgGraphics.fillRect(0, riverY + 8, CANVAS_W, riverH - 16);
    // Animated ripple highlights
    this.bgGraphics.fillStyle(0x64b5f6, 0.45);
    for (let i = 0; i < 12; i++) {
      const wx = (i * 56 + ((this.exitPulseTimer / 8) % 56)) % CANVAS_W;
      this.bgGraphics.fillEllipse(wx, riverY + 16, 40, 5);
      this.bgGraphics.fillEllipse(wx + 28, riverY + 30, 30, 4);
    }
    this.bgGraphics.fillStyle(0x0d47a1, 0.6);
    this.bgGraphics.fillRect(0, riverY + riverH - 8, CANVAS_W, 8);

    // Rocks in the river
    const riverRocks = [
      { x: 45,  y: riverY + 22, rw: 22, rh: 14 },
      { x: 120, y: riverY + 14, rw: 18, rh: 11 },
      { x: 195, y: riverY + 28, rw: 26, rh: 15 },
      { x: 290, y: riverY + 18, rw: 20, rh: 12 },
      { x: 370, y: riverY + 30, rw: 24, rh: 14 },
      { x: 450, y: riverY + 16, rw: 19, rh: 11 },
      { x: 530, y: riverY + 24, rw: 22, rh: 13 },
      { x: 610, y: riverY + 20, rw: 17, rh: 10 },
    ];
    for (const r of riverRocks) {
      this.bgGraphics.fillStyle(0x0d47a1, 0.5);
      this.bgGraphics.fillEllipse(r.x + 2, r.y + 3, r.rw, r.rh * 0.6);
      this.bgGraphics.fillStyle(0x4a6fa5);
      this.bgGraphics.fillEllipse(r.x, r.y, r.rw, r.rh);
      this.bgGraphics.fillStyle(0x7fa8d8, 0.55);
      this.bgGraphics.fillEllipse(r.x - 3, r.y - 3, r.rw * 0.55, r.rh * 0.5);
    }

    // Fence along top edge of the river
    this.bgGraphics.fillStyle(0xc8a050);
    for (let fx = 4; fx < CANVAS_W; fx += 22) {
      this.bgGraphics.fillRect(fx, riverY - 10, 6, 14);
      this.bgGraphics.fillStyle(0xe8c070);
      this.bgGraphics.fillRect(fx, riverY - 10, 6, 4);
      this.bgGraphics.fillStyle(0xc8a050);
    }
    this.bgGraphics.fillStyle(0xb08840);
    this.bgGraphics.fillRect(0, riverY - 5, CANVAS_W, 3);
    this.bgGraphics.fillRect(0, riverY - 1, CANVAS_W, 2);

    // Walls — bamboo fence for Explorer, stone for Survivor/Legend
    if (gameLevel <= 2) {
      for (const key of this.walls) {
        const [col, row] = key.split(',').map(Number);
        const px = col * CELL_SIZE;
        const py = row * CELL_SIZE;
        this.bgGraphics.fillStyle(0xc8a050);
        this.bgGraphics.fillRect(px + 3, py + 1, CELL_SIZE - 6, CELL_SIZE - 2);
        this.bgGraphics.fillStyle(0xe8c070);
        this.bgGraphics.fillRect(px + 3, py + 1, CELL_SIZE - 6, 4);
        this.bgGraphics.fillStyle(0x8b6020, 0.5);
        this.bgGraphics.fillRect(px + 3, py + 1, 3, CELL_SIZE - 2);
        this.bgGraphics.fillRect(px + CELL_SIZE - 6, py + 1, 3, CELL_SIZE - 2);
        this.bgGraphics.lineStyle(1.5, 0xa07838, 0.8);
        this.bgGraphics.strokeRect(px + 3, py + CELL_SIZE / 2, CELL_SIZE - 6, 0);
      }
    } else {
      const isBridgeLevel = !!this.exitZone;
      if (isBridgeLevel) {
        this.bgGraphics.fillStyle(0x8b6520);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
        this.bgGraphics.lineStyle(1, 0x5a3210, 0.7);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          this.bgGraphics.strokeRect(col * CELL_SIZE + 2, row * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE - 4, 0);
        }
        this.bgGraphics.fillStyle(0xc89040, 0.35);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, 3);
        }
      } else {
        this.bgGraphics.fillStyle(0x7a6850);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
        this.bgGraphics.fillStyle(0xaa9070, 0.4);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, 3);
        }
        this.bgGraphics.lineStyle(1, 0x5a4a38, 0.6);
        for (const key of this.walls) {
          const [col, row] = key.split(',').map(Number);
          this.bgGraphics.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }

  private drawPoisonTiles(): void {
    this.bgGraphics.fillStyle(0x9b1a00, 0.7);
    for (const key of this.poisonTiles) {
      const [col, row] = key.split(',').map(Number);
      this.bgGraphics.fillRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  private drawIQGates(): void {
    for (const gate of this.iqGates) {
      if (gate.open) continue;
      const px = gate.col * CELL_SIZE;
      const py = gate.row * CELL_SIZE;
      this.bgGraphics.fillStyle(0x8800cc);
      this.bgGraphics.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      this.bgGraphics.lineStyle(2, 0xffdd00, 0.9);
      this.bgGraphics.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
      // Draw a diamond marker
      const cx = px + CELL_SIZE / 2;
      const cy = py + CELL_SIZE / 2;
      const s = 5;
      this.topGraphics.fillStyle(0xffdd00, 0.9);
      this.topGraphics.fillTriangle(cx, cy - s, cx + s, cy, cx, cy + s);
      this.topGraphics.fillTriangle(cx, cy - s, cx - s, cy, cx, cy + s);
    }
  }

  /** Gentle indoor dim — darker at room edges, lighter near Glory; more intense during escape rush */
  private drawHouseDim(): void {
    const gc = this.gloryCell();
    const lightRadius = this.escapeRushActive ? 4 : 6.5;
    const maxAlpha    = this.escapeRushActive ? 0.68 : 0.50;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dist = Math.hypot(col - gc.x, row - gc.y);
        if (dist > lightRadius) {
          const alpha = Math.min(maxAlpha, (dist - lightRadius) * 0.10);
          this.overlayGraphics.fillStyle(0x000008, alpha);
          this.overlayGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
    // Jump scare white flash
    if (this.jumpScareFlashMs > 0) {
      const flashAlpha = (this.jumpScareFlashMs / 180) * 0.75;
      this.overlayGraphics.fillStyle(0xffffff, flashAlpha);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  private drawFogOfWar(): void {
    const gc = this.gloryCell();
    const FOG_RADIUS = 4;
    this.overlayGraphics.fillStyle(0x000011, 0.88);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const dist = Math.hypot(col - gc.x, row - gc.y);
        if (dist > FOG_RADIUS) {
          this.overlayGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }

  private drawSnakes(): void {
    const tongueOut = (this.tongueTimer % 800) < 280;

    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      // Don't draw snakes that are fully hidden in their spawn bush
      if (!snake.emerged && !snake.retreating) continue;

      // 🟢 Sleeping snake — draw as a coiled spiral instead of the normal body
      if (snake.behavior === 'sleeper' && !snake.awake) {
        this.drawSleepingSnake(snake);
        continue;
      }

      const stunned = snake.stunnedMs > 0;
      const alpha   = (stunned ? 0.4 : 1.0) * (snake.retreating ? 0.65 : 1.0);
      const segs    = snake.segments;
      const n       = segs.length;

      // Smaller than Glory — slim natural snake
      const bodyR = snake.isBoss ? 5 : 3;
      const headR = snake.isBoss ? 7 : 4;

      const bright = this.shiftColor(snake.color, 1.35);
      const dark   = this.shiftColor(snake.color, 0.55);

      // Head direction
      let dx = 0, dy = 0;
      if (n > 1) {
        dx = segs[0].x - segs[1].x;
        dy = segs[0].y - segs[1].y;
        const mag = Math.hypot(dx, dy) || 1;
        dx /= mag; dy /= mag;
      }
      const px2 = -dy, py2 = dx;

      // ── Body segments: draw filled rectangles between adjacent segments ──
      // This bridges the 20px cell gap so the body looks connected, not dotted
      const t = snake.lerpT;   // 0 = just moved, 1 = fully arrived
      for (let i = n - 1; i >= 1; i--) {
        const segA  = segs[i];       // current (tail side)
        const segB  = segs[i - 1];   // next toward head
        const prevA = snake.prevSegments[i]     ?? segA;
        const prevB = snake.prevSegments[i - 1] ?? segB;

        const ax = (prevA.x + (segA.x - prevA.x) * t) * CELL_SIZE + CELL_SIZE / 2;
        const ay = (prevA.y + (segA.y - prevA.y) * t) * CELL_SIZE + CELL_SIZE / 2;
        const bx = (prevB.x + (segB.x - prevB.x) * t) * CELL_SIZE + CELL_SIZE / 2;
        const by = (prevB.y + (segB.y - prevB.y) * t) * CELL_SIZE + CELL_SIZE / 2;

        // Taper: last 25% of body shrinks toward a point tail
        const tailFrac = i / (n - 1);
        const r = bodyR * (tailFrac > 0.75 ? 1 - (tailFrac - 0.75) * 3.5 : 1);
        if (r < 0.4) continue;

        this.bgGraphics.fillStyle(snake.color, alpha);

        // Filled rectangle bridging the gap between this segment and the next
        const mdx = bx - ax;
        const mdy = by - ay;
        if (Math.abs(mdx) >= Math.abs(mdy)) {
          // Horizontal connection
          this.bgGraphics.fillRect(Math.min(ax, bx), ay - r, Math.abs(mdx) || 1, r * 2);
        } else {
          // Vertical connection
          this.bgGraphics.fillRect(ax - r, Math.min(ay, by), r * 2, Math.abs(mdy) || 1);
        }

        // Rounded joint circle at this segment position
        this.bgGraphics.fillCircle(ax, ay, r);

        // Gloss highlight on body
        this.bgGraphics.fillStyle(0xffffff, alpha * 0.30);
        this.bgGraphics.fillCircle(ax - r * 0.3, ay - r * 0.3, r * 0.35);
      }

      // ── Head ──────────────────────────────────────────────────────────
      const hx = segs[0].x * CELL_SIZE + CELL_SIZE / 2;
      const hy = segs[0].y * CELL_SIZE + CELL_SIZE / 2;

      if (snake.isBoss) {
        this.bgGraphics.fillStyle(0xffaa00, alpha * 0.30);
        this.bgGraphics.fillCircle(hx, hy, headR + 5);
      }

      // Head oval — slightly elongated in movement direction
      this.bgGraphics.fillStyle(snake.color, alpha);
      this.bgGraphics.fillEllipse(
        hx + dx * headR * 0.15,
        hy + dy * headR * 0.15,
        headR * 2.1 + Math.abs(dx) * headR * 0.30,
        headR * 2.1 + Math.abs(dy) * headR * 0.30
      );

      // Dark cap on back of head
      this.bgGraphics.fillStyle(dark, alpha * 0.38);
      this.bgGraphics.fillCircle(hx - dx * headR * 0.20, hy - dy * headR * 0.20, headR * 0.80);

      // Gloss highlight
      this.bgGraphics.fillStyle(bright, alpha * 0.42);
      this.bgGraphics.fillCircle(
        hx - dx * headR * 0.15 - px2 * headR * 0.18,
        hy - dy * headR * 0.15 - py2 * headR * 0.18,
        headR * 0.42
      );
      this.bgGraphics.fillStyle(0xffffff, alpha * 0.55);
      this.bgGraphics.fillCircle(
        hx - dx * headR * 0.22 - px2 * headR * 0.25,
        hy - dy * headR * 0.22 - py2 * headR * 0.25,
        headR * 0.22
      );

      // ── Eyes — small, forward-placed, friendly ─────────────────────────
      const eyeDist = headR * 0.46;
      const eyeFwd  = headR * 0.32;
      const eyeR    = headR * 0.30;

      for (const side of [1, -1]) {
        const ex = hx + px2 * side * eyeDist + dx * eyeFwd;
        const ey = hy + py2 * side * eyeDist + dy * eyeFwd;

        this.bgGraphics.fillStyle(0xffffff, alpha);
        this.bgGraphics.fillCircle(ex, ey, eyeR);

        this.bgGraphics.fillStyle(0x111111, alpha);
        this.bgGraphics.fillCircle(ex + dx * eyeR * 0.25, ey + dy * eyeR * 0.25, eyeR * 0.58);

        // Eye shine
        this.bgGraphics.fillStyle(0xffffff, alpha * 0.90);
        this.bgGraphics.fillCircle(
          ex - dx * eyeR * 0.15 + px2 * side * eyeR * 0.18,
          ey - dy * eyeR * 0.15 + py2 * side * eyeR * 0.18,
          eyeR * 0.28
        );
      }

      // ── Tongue ────────────────────────────────────────────────────────
      if (tongueOut && !stunned) {
        const tLen = 7, fLen = 4;
        const t1x  = hx + dx * (headR * 1.05 + tLen);
        const t1y  = hy + dy * (headR * 1.05 + tLen);
        this.bgGraphics.lineStyle(1.3, 0xff2255, alpha);
        this.bgGraphics.beginPath();
        this.bgGraphics.moveTo(hx + dx * headR * 0.85, hy + dy * headR * 0.85);
        this.bgGraphics.lineTo(t1x, t1y);
        this.bgGraphics.strokePath();
        this.bgGraphics.beginPath();
        this.bgGraphics.moveTo(t1x, t1y);
        this.bgGraphics.lineTo(t1x + (dx - py2) * fLen, t1y + (dy + px2) * fLen);
        this.bgGraphics.strokePath();
        this.bgGraphics.beginPath();
        this.bgGraphics.moveTo(t1x, t1y);
        this.bgGraphics.lineTo(t1x + (dx + py2) * fLen, t1y + (dy - px2) * fLen);
        this.bgGraphics.strokePath();
      }

      // ── Stunned stars ─────────────────────────────────────────────────
      if (stunned) {
        this.bgGraphics.fillStyle(0xffff44, 0.9);
        this.bgGraphics.fillCircle(hx,     hy - headR - 5, 2.8);
        this.bgGraphics.fillCircle(hx - 6, hy - headR - 2, 2.0);
        this.bgGraphics.fillCircle(hx + 6, hy - headR - 2, 2.0);
      }
    }
  }

  /** Multiply each RGB channel by factor (>1 = lighter, <1 = darker) */
  private shiftColor(hex: number, factor: number): number {
    const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((hex >>  8) & 0xff) * factor));
    const b = Math.min(255, Math.round(( hex        & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }

  private drawSleepingSnake(snake: SnakeEnemy): void {
    const g = this.bgGraphics;
    const t = this.time.now;
    const sx = snake.spawnCol * CELL_SIZE + CELL_SIZE / 2;
    const sy = snake.spawnRow * CELL_SIZE + CELL_SIZE / 2;
    const breathe = 0.92 + 0.08 * Math.sin(t / 900);  // slow breathing pulse

    // Outer coil ring
    g.lineStyle(4, snake.color, 0.85 * breathe);
    g.strokeCircle(sx, sy, 7 * breathe);
    // Inner coil ring
    g.lineStyle(3, snake.color, 0.65 * breathe);
    g.strokeCircle(sx, sy, 4 * breathe);
    // Center dot (head)
    g.fillStyle(snake.color, 0.9);
    g.fillCircle(sx, sy, 2.5);
    // Closed-eye slits
    g.lineStyle(1.5, 0x000000, 0.8);
    g.beginPath(); g.moveTo(sx - 4, sy - 1); g.lineTo(sx - 2, sy - 1); g.strokePath();
    g.beginPath(); g.moveTo(sx + 2, sy - 1); g.lineTo(sx + 4, sy - 1); g.strokePath();
    // Floating "z" dots (sleep indicator)
    const zPhase = (t % 1800) / 1800;
    const za = Math.max(0, Math.sin(zPhase * Math.PI));
    g.fillStyle(0xffffff, za * 0.7);
    g.fillCircle(sx + 8 + zPhase * 4, sy - 8 - zPhase * 5, 2);
    g.fillStyle(0xffffff, za * 0.4);
    g.fillCircle(sx + 11 + zPhase * 3, sy - 13 - zPhase * 4, 1.5);
  }

  private drawGloryFallen(x: number, y: number, fallMs: number): void {
    const g = this.topGraphics;
    const totalMs = 1200;
    // 0–200ms = tipping over; 200–1200ms = lying flat
    const tipFrac  = Math.min(1, (totalMs - fallMs) / 200);   // 0→1 as she falls
    const flatFrac = Math.max(0, (totalMs - fallMs - 200) / 1000);  // 0→1 while lying

    // Rotation from standing (angle from facing) to lying (90° tipped)
    const baseAngle = this.facingAngle + Math.PI / 2 * tipFrac;

    const cos = Math.cos(baseAngle);
    const sin = Math.sin(baseAngle);

    // Enlarged ground shadow (she's flat on the ground)
    g.fillStyle(0x000000, 0.22 * tipFrac);
    g.fillEllipse(x + 2, y + 4, 36 * tipFrac + 14, 12);

    // ── Body flat on ground ──────────────────────────────────────────────────
    // Torso — elongated horizontally
    const jacketColor = 0x2266cc;
    g.fillStyle(jacketColor, 1.0);
    g.fillEllipse(x, y, 22 * (0.4 + 0.6 * tipFrac), 12);

    // Jacket highlight
    g.fillStyle(0x4499ee, 0.55);
    g.fillEllipse(x - sin * 2.5, y + cos * 2.5, 7, 7);

    // ── Splayed legs ────────────────────────────────────────────────────────
    const legOff = 8 + tipFrac * 4;
    // Left leg
    g.fillStyle(0x1a2e55);
    g.fillCircle(x + cos * legOff + sin * 6, y + sin * legOff - cos * 6, 4.5);
    g.fillStyle(0x111111);
    g.fillCircle(x + cos * (legOff + 4) + sin * 6, y + sin * (legOff + 4) - cos * 6, 3);
    // Right leg
    g.fillStyle(0x1a2e55);
    g.fillCircle(x + cos * legOff - sin * 6, y + sin * legOff + cos * 6, 4.5);
    g.fillStyle(0x111111);
    g.fillCircle(x + cos * (legOff + 4) - sin * 6, y + sin * (legOff + 4) + cos * 6, 3);

    // ── Splayed arms ────────────────────────────────────────────────────────
    g.fillStyle(jacketColor);
    g.fillCircle(x - cos * 3 + sin * 10, y - sin * 3 - cos * 10, 4);
    g.fillStyle(0xf5c09a);
    g.fillCircle(x - cos * 3 + sin * 13, y - sin * 3 - cos * 13, 3);

    g.fillStyle(jacketColor);
    g.fillCircle(x - cos * 3 - sin * 10, y - sin * 3 + cos * 10, 4);
    g.fillStyle(0xf5c09a);
    g.fillCircle(x - cos * 3 - sin * 13, y - sin * 3 + cos * 13, 3);

    // ── Head (at the "top" of the body) ─────────────────────────────────────
    const headX = x - cos * 10;
    const headY = y - sin * 10;

    // Hair
    g.fillStyle(0x2c1a00);
    g.fillCircle(headX - cos * 1.5, headY - sin * 1.5, 8);
    // Face
    g.fillStyle(0xf5c09a);
    g.fillCircle(headX, headY, 7.5);

    // X eyes (knocked out)
    const eyeA  = baseAngle - Math.PI / 2;
    const eyeCos = Math.cos(eyeA);
    const eyeSin = Math.sin(eyeA);
    for (const side of [1, -1]) {
      const ex = headX + eyeCos * side * 2.8;
      const ey = headY + eyeSin * side * 2.8;
      g.lineStyle(1.8, 0x333333, 0.90);
      g.beginPath(); g.moveTo(ex - 1.8, ey - 1.8); g.lineTo(ex + 1.8, ey + 1.8); g.strokePath();
      g.beginPath(); g.moveTo(ex + 1.8, ey - 1.8); g.lineTo(ex - 1.8, ey + 1.8); g.strokePath();
    }

    // ── Spinning dizzy stars ─────────────────────────────────────────────────
    if (flatFrac > 0) {
      const starCount = 4;
      const spinSpeed = flatFrac * 3.5;
      const spinAngle = (this.tongueTimer * 0.003) * spinSpeed;
      const radius = 12 + flatFrac * 4;
      for (let i = 0; i < starCount; i++) {
        const a = spinAngle + (i / starCount) * Math.PI * 2;
        const sx = headX + Math.cos(a) * radius;
        const sy = headY + Math.sin(a) * (radius * 0.55);
        const starSize = 3.5 + Math.sin(a * 2) * 1.0;
        g.fillStyle(0xffee22, 0.95);
        g.fillCircle(sx, sy, starSize);
        g.fillStyle(0xffffff, 0.70);
        g.fillCircle(sx - 1, sy - 1, starSize * 0.45);
      }
    }

    // ── Venom splash (green pulse, strongest on first 400ms) ─────────────────
    const venomAlpha = Math.max(0, (400 - (totalMs - fallMs)) / 400) * 0.50;
    if (venomAlpha > 0) {
      g.fillStyle(0x44ff44, venomAlpha);
      g.fillCircle(x, y, 18 + (1 - venomAlpha) * 10);
      g.fillStyle(0x00cc00, venomAlpha * 0.5);
      g.fillCircle(x, y, 10);
    }
  }

  private drawGlory(): void {
    const { x, y, invincibleMs } = this.glory;

    // ── Fallen / bitten pose ───────────────────────────────────────────────
    if (this.gloryFallMs > 0) {
      this.drawGloryFallen(x, y, this.gloryFallMs);
      return;
    }

    if (invincibleMs > 0) {
      const flashOn = Math.floor(invincibleMs / 140) % 2 === 0;
      if (!flashOn) return;
    }

    // When successfully hidden inside a shelter or berry-invisible, draw semi-transparent
    const alpha = (this.hiddenInBush && this.hidingSuccess) || this.berryInvisibleMs > 0 || this.smokeActiveMs > 0 ? 0.30 : 1.0;

    // Facing direction vectors from smoothly-interpolated angle
    const fwdX = Math.cos(this.facingAngle);
    const fwdY = Math.sin(this.facingAngle);
    const perpX = -fwdY;
    const perpY =  fwdX;

    // Walking cycle: legs swing when moving
    const moving = (this.dragDir !== null) || (this.joystickActive);
    const walkPhase = moving ? this.tongueTimer * 0.007 : 0;
    const legSwing = Math.sin(walkPhase) * 4.5;

    // ── Ground shadow ──────────────────────────────────────────────────────
    this.topGraphics.fillStyle(0x000000, 0.18 * alpha);
    this.topGraphics.fillEllipse(x + 2, y + 3, 22, 10);

    // ── Dust footstep trail ────────────────────────────────────────────────
    for (let i = 3; i < Math.min(this.gloryTrail.length, 18); i += 3) {
      const seg = this.gloryTrail[i];
      const t = i / 18;
      this.topGraphics.fillStyle(0xc8a46e, alpha * 0.18 * (1 - t));
      this.topGraphics.fillCircle(seg.x, seg.y, 3.5 * (1 - t * 0.6));
    }

    // ── Legs (behind body) ─────────────────────────────────────────────────
    const backX = x - fwdX * 5;
    const backY = y - fwdY * 5;

    // Left leg
    const llX = backX + perpX * 4 - fwdX * legSwing;
    const llY = backY + perpY * 4 - fwdY * legSwing;
    this.topGraphics.fillStyle(0x1a2e55, alpha);         // dark navy trousers
    this.topGraphics.fillCircle(llX, llY, 4.5);
    this.topGraphics.fillStyle(0x111111, alpha);          // shoe
    this.topGraphics.fillCircle(llX - fwdX * 0.5, llY - fwdY * 0.5, 3);

    // Right leg
    const rlX = backX - perpX * 4 + fwdX * legSwing;
    const rlY = backY - perpY * 4 + fwdY * legSwing;
    this.topGraphics.fillStyle(0x1a2e55, alpha);
    this.topGraphics.fillCircle(rlX, rlY, 4.5);
    this.topGraphics.fillStyle(0x111111, alpha);
    this.topGraphics.fillCircle(rlX - fwdX * 0.5, rlY - fwdY * 0.5, 3);

    // ── Torso / jacket ────────────────────────────────────────────────────
    this.topGraphics.fillStyle(invincibleMs > 0 ? 0xff5533 : 0x2266cc, alpha);  // blue explorer jacket
    this.topGraphics.fillEllipse(x, y, 16, 14);

    // Jacket highlight stripe
    this.topGraphics.fillStyle(0x4499ee, alpha * 0.6);
    this.topGraphics.fillEllipse(x - perpX * 2.5, y - perpY * 2.5, 5, 9);

    // ── Arms ───────────────────────────────────────────────────────────────
    const armSwing = -Math.sin(walkPhase) * 3.5;
    const armForOff = fwdX * 1.5 + fwdX * armSwing;
    const armForOffY = fwdY * 1.5 + fwdY * armSwing;

    // Left arm
    const laX = x + perpX * 9 + armForOff;
    const laY = y + perpY * 9 + armForOffY;
    this.topGraphics.fillStyle(0x2266cc, alpha);
    this.topGraphics.fillCircle(laX, laY, 4);
    this.topGraphics.fillStyle(0xf5c09a, alpha);          // skin hand
    this.topGraphics.fillCircle(laX + fwdX * 1.5, laY + fwdY * 1.5, 2.8);

    // Right arm
    const raX = x - perpX * 9 - armForOff;
    const raY = y - perpY * 9 - armForOffY;
    this.topGraphics.fillStyle(0x2266cc, alpha);
    this.topGraphics.fillCircle(raX, raY, 4);
    this.topGraphics.fillStyle(0xf5c09a, alpha);
    this.topGraphics.fillCircle(raX + fwdX * 1.5, raY + fwdY * 1.5, 2.8);

    // ── Head ──────────────────────────────────────────────────────────────
    const headX = x + fwdX * 9;
    const headY = y + fwdY * 9;

    // Neck
    this.topGraphics.fillStyle(0xf5c09a, alpha);
    this.topGraphics.fillCircle(x + fwdX * 5, y + fwdY * 5, 4.5);

    // Head circle (skin)
    this.topGraphics.fillStyle(0xf5c09a, alpha);
    this.topGraphics.fillCircle(headX, headY, 7.5);

    // Hair — dark brown cap covering back of head
    this.topGraphics.fillStyle(0x2b1700, alpha);
    this.topGraphics.fillCircle(headX - fwdX * 1.5, headY - fwdY * 1.5, 7.0);
    this.topGraphics.fillStyle(0x3d2201, alpha);
    this.topGraphics.fillCircle(headX - fwdX * 2.5, headY - fwdY * 2.5, 5.5);

    // Eyes — two dark dots on face side
    const eyeForOff = 3.5;
    const eyeSideOff = 3.0;
    const eyeLX = headX + fwdX * eyeForOff + perpX * eyeSideOff;
    const eyeLY = headY + fwdY * eyeForOff + perpY * eyeSideOff;
    const eyeRX = headX + fwdX * eyeForOff - perpX * eyeSideOff;
    const eyeRY = headY + fwdY * eyeForOff - perpY * eyeSideOff;

    this.topGraphics.fillStyle(0xffffff, alpha * 0.9);
    this.topGraphics.fillCircle(eyeLX, eyeLY, 2.2);
    this.topGraphics.fillCircle(eyeRX, eyeRY, 2.2);

    this.topGraphics.fillStyle(0x111111, alpha);
    this.topGraphics.fillCircle(eyeLX + fwdX * 0.5, eyeLY + fwdY * 0.5, 1.3);
    this.topGraphics.fillCircle(eyeRX + fwdX * 0.5, eyeRY + fwdY * 0.5, 1.3);

    // Speed power-up glow ring
    if (this.activePowerUp?.kind === 'speed') {
      this.topGraphics.lineStyle(3, 0xffff44, 0.7);
      this.topGraphics.strokeCircle(x, y, 24);
    }
    // Berry invisibility shimmer ring
    if (this.berryInvisibleMs > 0) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 150);
      this.topGraphics.lineStyle(3, 0xff44cc, pulse);
      this.topGraphics.strokeCircle(x, y, 22);
    }
    // Smoke bomb — expanding grey cloud rings
    if (this.smokeActiveMs > 0) {
      const t = Date.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const phase = (t * 1.2 + i * 0.4) % 1;
        const radius = 14 + phase * 22;
        const opacity = (1 - phase) * 0.55;
        this.topGraphics.lineStyle(4, 0xaaccaa, opacity);
        this.topGraphics.strokeCircle(x, y, radius);
      }
      // Grey fill to show concealment
      const fogAlpha = 0.18 + 0.06 * Math.sin(Date.now() / 200);
      this.topGraphics.fillStyle(0x88aa88, fogAlpha);
      this.topGraphics.fillCircle(x, y, 28);
    }
    // Stick swing flash — yellow arc burst toward nearest snake
    if (this.stickSwingMs > 0) {
      const frac = this.stickSwingMs / 500;
      this.topGraphics.lineStyle(3, 0xffcc44, frac * 0.9);
      this.topGraphics.strokeCircle(x, y, (1 - frac) * 30 + 12);
    }
    // Stealth aura — soft green halo visible only to player (not snakes!)
    if (this.gloryStealthMode && this.berryInvisibleMs <= 0) {
      const pulse = 0.12 + 0.08 * Math.sin(Date.now() / 220);
      this.topGraphics.lineStyle(2, 0x44ff88, pulse);
      this.topGraphics.strokeCircle(x, y, 19);
    }
  }

  private drawHintArrow(): void {
    let nearest: SnakeEnemy | null = null;
    let nearestDist = Infinity;
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const h = snake.segments[0];
      const sx = h.x * CELL_SIZE + CELL_SIZE / 2;
      const sy = h.y * CELL_SIZE + CELL_SIZE / 2;
      const d = Math.hypot(sx - this.glory.x, sy - this.glory.y);
      if (d < nearestDist) { nearestDist = d; nearest = snake; }
    }
    if (!nearest) return;

    const h = nearest.segments[0];
    const sx = h.x * CELL_SIZE + CELL_SIZE / 2;
    const sy = h.y * CELL_SIZE + CELL_SIZE / 2;
    const dx = this.glory.x - sx;
    const dy = this.glory.y - sy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const nx = dx / len;
    const ny = dy / len;
    const ax = this.glory.x + nx * 28;
    const ay = this.glory.y + ny * 28;

    this.topGraphics.lineStyle(3, 0xffff00, 0.95);
    this.topGraphics.beginPath();
    this.topGraphics.moveTo(this.glory.x + nx * 14, this.glory.y + ny * 14);
    this.topGraphics.lineTo(ax, ay);
    this.topGraphics.strokePath();

    const perpX = -ny * 5;
    const perpY =  nx * 5;
    this.topGraphics.fillStyle(0xffff00, 0.95);
    this.topGraphics.fillTriangle(
      ax, ay,
      ax - nx * 10 + perpX, ay - ny * 10 + perpY,
      ax - nx * 10 - perpX, ay - ny * 10 - perpY,
    );
  }

  // ── Round end ──────────────────────────────────────────────────────────────
  private showEndOverlay(msg: string, showNextLevel: boolean): void {
    this.roundOver = true;
    this.snakeTickTimer?.remove();
    this.dismissSusieOffer();

    this.overlayGraphics.clear();
    this.overlayGraphics.fillStyle(0x000000, 0.72);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.overlayText.setText(msg);

    if (showNextLevel) {
      document.getElementById('next-level-btn')?.classList.remove('hidden');
      document.getElementById('retry-btn')?.classList.add('hidden');
    } else {
      document.getElementById('retry-btn')?.classList.remove('hidden');
      document.getElementById('next-level-btn')?.classList.add('hidden');
    }
  }

  private gameOver(): void {
    this.showEndOverlay(`💀 Game Over!\nScore: ${this.score}`, false);
  }

  // ── Level 2 cinematic ending ───────────────────────────────────────────────
  private triggerLevel2Ending(): void {
    if (this.roundOver) return;
    this.roundOver = true;   // stop collision checks and movement
    this.snakeTickTimer?.remove();

    // Phase 1 (0–800ms): Glory leaps — accelerate her rightward off screen
    // Phase 2 (800–2000ms): snakes reach edge and freeze; wind fades
    // Phase 3 (2000–3400ms): calm moment, text fades in
    // Phase 4 (3400ms): show win overlay

    // Freeze all snakes at their current positions (they "stop at edge")
    this.time.delayedCall(900, () => {
      for (const sn of this.snakes) {
        sn.stunnedMs = 99999; // effectively frozen
        sn.retreating = false;
      }
    });

    // Screen flash — jump to safety!
    this.cameras.main.flash(400, 255, 255, 255, false);
    this.cameras.main.shake(280, 0.012);

    // Cinematic text sequence
    this.overlayText.setVisible(true);
    this.overlayText.setText('🏃‍♀️ JUMP!');
    this.time.delayedCall(800,  () => {
      this.overlayText.setText('😮‍💨 She made it…');
      this.cameras.main.shake(150, 0.004);
    });
    this.time.delayedCall(1600, () => {
      this.overlayText.setText('🐍 The snakes stop at the edge…');
    });
    this.time.delayedCall(2500, () => {
      this.overlayText.setText('🌬️ The wind slowly fades…');
      // Fade wind particle effect out
      for (const p of this.windParticles) { p.alpha = 0; }
    });
    this.time.delayedCall(3400, () => {
      this.overlayText.setText('🌄 A moment of calm…\nThe trail awaits ahead.');
    });
    this.time.delayedCall(4600, () => {
      this.winGame();   // shows score and next-level button
    });

    // Launch Glory off the right edge during the jump
    this.time.addEvent({
      delay: 30,
      repeat: 25,
      callback: () => {
        this.glory.x = Math.min(CANVAS_W + 30, this.glory.x + 8);
        this.glory.y += 3; // slight arc downward — jumping off
        this.drawScene();
      },
    });
  }

  private winGame(): void {
    const config = LEVEL_CONFIGS[gameLevel - 1];
    this.score = Math.floor((this.survivalMs / 1000) * config.scoreMultiplier);
    this.updateDOM();
    window.dispatchEvent(new CustomEvent('snake-level-complete', { detail: { level: gameLevel } }));
    this.showEndOverlay(`🏆 You Survived!\nScore: ${this.score}`, true);
  }

  private resetGame(): void {
    document.getElementById('retry-btn')?.classList.add('hidden');
    document.getElementById('next-level-btn')?.classList.add('hidden');
    document.getElementById('challenge-overlay')?.classList.add('hidden');
    this.overlayText.setText('');
    this.overlayGraphics.clear();
    this.dismissSusieOffer();
    this.initGame();
    this.updateDOM();
  }

  shutdown(): void {
    this.snakeTickTimer?.remove();
    if (this.powerUpOfferTimeout) {
      clearTimeout(this.powerUpOfferTimeout);
      this.powerUpOfferTimeout = null;
    }
    for (const { el, event, fn } of this.domListeners) {
      el.removeEventListener(event, fn);
    }
    this.domListeners = [];
    document.getElementById('susie-bubble')?.classList.add('hidden');
    document.getElementById('challenge-overlay')?.classList.add('hidden');
    document.getElementById('stealth-indicator')?.classList.add('hidden');
    document.getElementById('berserk-indicator')?.classList.add('hidden');
    document.getElementById('escape-rush-indicator')?.classList.add('hidden');
    this.smokeActiveMs = 0;
    this.stickSwingMs = 0;
    this.escapeRushActive = false;
    this.escapeRushMs = 0;
    this.jumpScareFlashMs = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }
}

export function createGame(opts: { bodyColor?: number; headColor?: number; level: number }): GameController {
  void opts.bodyColor;
  void opts.headColor;
  gameLevel = opts.level;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_W,
    height: CANVAS_H,
    parent: 'game-root',
    backgroundColor: '#060810',
    scene: VenomArenaScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  return {
    destroy(): void {
      game.destroy(true);
      document.getElementById('susie-bubble')?.classList.add('hidden');
      document.getElementById('challenge-overlay')?.classList.add('hidden');
    },
  };
}
