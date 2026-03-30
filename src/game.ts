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

type SnakeBehavior = 'chaser' | 'random' | 'guard' | 'slow' | 'patrol' | 'hunter';
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
  collectibles?: [number, number][];
  gloryStart?: { col: number; row: number };
  bushes?: [number, number][];
  bannerText?: string;      // shown as popup text when level starts (e.g. Level 3)
  windEffect?: boolean;     // Level 9: wind pushes snake slightly
  reversedControls?: boolean; // Mirror Maze: joystick direction is inverted
  isBonus?: boolean;          // marks as bonus level
  snakeEnemyConfigs?: SnakeEnemyConfig[];  // per-snake behavior overrides (replaces snakeCount when set)
}

const LEVEL_CONFIGS: LevelConfig[] = [
  // Level 1: Mountain Path — winding cliff trail with dead-end alcove, narrow cliff ledges, S-curve
  {
    name: 'Mountain Path',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 600, glorySpeed: 1.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    bannerText: '🏔️ VENOM ARENA\nMOUNTAIN PATH',
    walls: [
      // ── Upper segment ────────────────────────────────────────────────────────
      ...hwall(4,  1, 19),    // top outer wall:        row 4,  cols 1-19
      ...hwall(9,  1,  3),    // bottom wall (left):    row 9,  cols 1-3  (before dead-end gap)
      ...hwall(9,  9, 15),    // bottom wall (right):   row 9,  cols 9-15 (after cliff; gap 16-19 for turn)
      // Narrow cliff ledge: inner ceiling lowers corridor to 2 cells tall at cols 9-13
      ...hwall(6,  9, 13),    // cliff inner ceiling:   row 6,  cols 9-13

      // ── Dead-end reward alcove (below upper corridor, cols 4-8, rows 9-12) ──
      ...vwall(3,  9, 12),    // alcove left wall:      col 3,  rows 9-12
      ...hwall(13, 3,  9),    // alcove bottom wall:    row 13, cols 3-9
      ...vwall(9,  9, 12),    // alcove right wall:     col 9,  rows 9-12

      // ── Connector — vertical corridor cols 17-19 ─────────────────────────────
      ...vwall(20, 5, 17),    // right wall:            col 20, rows 5-17
      ...vwall(16, 10, 17),   // left wall:             col 16, rows 10-17
      // Narrow cliff passage: narrows connector to 2 cols (18-19) at rows 12-14
      ...vwall(17, 12, 14),   // connector cliff:       col 17, rows 12-14

      // ── Lower segment ────────────────────────────────────────────────────────
      ...hwall(18, 20, 31),   // top outer wall:        row 18, cols 20-31 (gap at 16-19 = connector entry)
      ...hwall(22, 16, 31),   // bottom outer wall:     row 22, cols 16-31
      ...vwall(16, 19, 21),   // left wall:             col 16, rows 19-21
      // S-curve: inner walls force a winding path through the lower corridor
      ...hwall(19, 21, 24),   // S-curve inner top:     row 19, cols 21-24 (forces rows 20-21)
      ...hwall(21, 25, 29),   // S-curve inner bottom:  row 21, cols 25-29 (forces rows 19-20)
    ],
    poisonTiles: [],
    iqGatePositions: [{ col: 30, row: 20, challengeIdx: 10 }],   // placed at exit end
    movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 0, row: 6 },   // outside the fence (col 0), just left of the entrance
    exitZone:   { col: 31, row: 20 }, // past the exit gate (exit is at col 30)
    collectibles: [
      // Upper corridor — 6 apples (adjusted: [9,6] was on cliff wall → moved to [9,7])
      [3,6], [6,7], [9,7], [12,7], [15,6], [17,7],
      // Dead-end alcove rewards — 4 apples (risk vs. reward!)
      [4,10], [6,11], [5,12], [7,10],
      // Connector — 2 apples
      [18,11], [18,15],
      // Lower corridor — 5 apples (adjusted: [23,19] was on S-curve wall → moved to [23,20])
      [21,20], [23,20], [25,20], [27,19], [29,20],
    ] as [number,number][],
    bushes: [[7, 6], [18, 14], [22, 20]],  // 3 hiding shelters along path
    snakeEnemyConfigs: [
      // 🟢 Slow Snakes (2) — plodding chasers, easy to outrun. Bright lime green.
      //    (startRow moved: 6→7 because row 6 is now the cliff inner ceiling wall)
      { behavior: 'slow',   tickMs: 680, startCol: 10, startRow: 7,  color: 0x7CFF4F },
      //    (startCol moved: 17→18 because col 17 is now the connector cliff wall at row 14)
      { behavior: 'slow',   tickMs: 680, startCol: 18, startRow: 14, color: 0x4db82e },
      // 🟡 Patrol Snakes (2) — walk fixed routes; chase only if Glory steps within 4 cells. Gold/orange.
      { behavior: 'patrol', tickMs: 400, startCol:  5, startRow: 8,  color: 0xffcc00,
        patrolA: { col: 3,  row: 7 }, patrolB: { col: 15, row: 7 } },
      { behavior: 'patrol', tickMs: 400, startCol: 18, startRow: 10, color: 0xff8800,
        patrolA: { col: 18, row: 9 }, patrolB: { col: 18, row: 16 } },
      // 🔴 Hunter Snakes (2) — aggressive, speed scales fast with apples. Hot pink / crimson.
      //    (startRow moved: 19→20 because row 19 is now the S-curve inner wall at col 23)
      { behavior: 'hunter', tickMs: 320, startCol: 23, startRow: 20, color: 0xFF5AAE },
      { behavior: 'hunter', tickMs: 320, startCol: 24, startRow: 21, color: 0xff2244 },
    ],
  },
  // Level 2: Narrow Trail — thinner path, more curves, no enemies
  {
    name: 'Narrow Trail',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 500, glorySpeed: 1.8, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    walls: [
      ...hwall(9,  2, 14), ...hwall(9, 16, 29),
      ...hwall(15, 2, 14), ...hwall(15, 16, 29),
      ...vwall(14, 9, 15), ...vwall(16, 9, 15),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 2, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[5,12],[7,11],[10,12],[13,11],[17,12],[19,11],[22,12],[25,11],[27,12]] as [number,number][],
    bushes: [[4,13],[9,11],[15,13],[21,11],[27,13]],
  },
  // Level 3: Bamboo Bridge — very narrow 2-row bridge
  {
    name: 'Bamboo Bridge',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 500, glorySpeed: 1.2, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    bannerText: '🌉 BAMBOO BRIDGE',
    walls: [
      ...hwall(10, 2, 29), ...hwall(11, 2, 29),
      ...hwall(14, 2, 29), ...hwall(15, 2, 29),
      ...vwall(7,  10, 14), ...vwall(13, 10, 14),
      ...vwall(19, 10, 14), ...vwall(25, 10, 14),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 2, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[5,12],[8,13],[11,12],[14,13],[17,12],[20,13],[23,12],[26,13]] as [number,number][],
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

type PowerUpKind = 'flashlight' | 'trap' | 'speed' | 'hint' | 'pistol';

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
  alive: boolean;
  stunnedMs: number;
  color: number;
  isBoss: boolean;
  behavior: SnakeBehavior;   // movement AI type
  tickMs: number;            // ms per move step (for per-snake timing)
  tickAccumMs: number;       // accumulated ms since last step
  emerged: boolean;          // false = hiding in spawn bush, waiting for Glory
  retreating: boolean;       // true = heading back to spawn bush
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
  private gloryTrail: Array<{x: number; y: number}> = [];
  private gloryTrailMax = 2;  // starts small, grows as apples are eaten

  private snakeTickTimer: Phaser.Time.TimerEvent | null = null;

  private survivalMs = 0;
  private score = 0;
  private roundOver = false;

  private activePowerUp: ActivePowerUp | null = null;
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
  private collectibles: Array<{ col: number; row: number; collected: boolean }> = [];
  private bushCells: Set<string> = new Set();
  private hiddenInBush = false;
  private hidingSuccess = false;          // true only after correctly answering the hide challenge
  private lastBushKey: string | null = null;
  private bushChallengeAnswered = false;  // prevents re-triggering while inside same bush
  private hidingSearchMs = 0;            // penalty countdown after a failed hide answer (ms remaining)
  private readonly HIDING_DURATION_MS = 4500;
  private challengeType: 'iqgate' | 'hide' | null = null;
  private pendingHideChallenge: Challenge | null = null;
  private usePerSnakeTick = false;
  private facingAngle = 0;
  private exitPulseTimer = 0;
  private hideSuccessTimerMs = 0;   // counts down after correct hide answer (check-sign animation)
  private gateOpen = false;         // Level 1 start gate — snakes don't emerge until opened
  private gateOpenAnimMs = 0;       // opening animation timer (counts up)
  private applesCollected = 0;          // how many apples Glory has eaten in Level 1
  private exitGateOpenAnimMs = -1;      // -1 = closed; ≥0 = opening animation timer
  private hideAttemptCount = 0;     // wrong-answer streak on current hide riddle (resets at 3)

  // Pistol power-up
  private pistolPickups: Array<{ col: number; row: number; taken: boolean }> = [];
  private pistolBullets = 0;
  private bullets: Bullet[] = [];

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
      challenge: gameLevel === 1
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
    this.collectibles = (config.collectibles ?? []).map(([col, row]) => ({ col, row, collected: false }));
    this.bushCells = new Set((config.bushes ?? []).map(([c, r]) => `${c},${r}`));
    this.hiddenInBush = false;
    this.hidingSuccess = false;
    this.lastBushKey = null;
    this.bushChallengeAnswered = false;
    this.hidingSearchMs = 0;
    this.hideSuccessTimerMs = 0;
    this.gateOpen = (gameLevel !== 1);   // Level 1 starts locked; all others open
    this.gateOpenAnimMs = 0;
    this.applesCollected = 0;
    this.exitGateOpenAnimMs = -1;
    this.hideAttemptCount = 0;
    this.exitPulseTimer = 0;

    // Pistol pickups — 2 guns hidden on the Level 1 path
    this.pistolPickups = gameLevel === 1
      ? [{ col: 7, row: 7, taken: false }, { col: 24, row: 20, taken: false }]
      : [];
    this.pistolBullets = 0;
    this.bullets = [];
    this.gloryFallMs = 0;
    this.updatePistolHUD();

    this.survivalMs = 0;
    this.score = 0;
    this.roundOver = false;
    this.activePowerUp = null;
    this.trap = null;
    this.waitingForTrapPlacement = false;
    this.susieCooldownMs = 5000;
    this.susieOfferActive = false;
    this.spawnAccumMs = 0;
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
    this.snakes.push({
      id, segments: segs, alive: true, stunnedMs: 0, color, isBoss,
      behavior: cfg?.behavior ?? 'chaser',
      tickMs: cfg?.tickMs ?? 600,
      baseTick: cfg?.tickMs ?? 600,
      tickAccumMs: Math.random() * (cfg?.tickMs ?? 600),
      emerged: !useBushSpawn,    // Level 1 snakes start hidden in their bushes
      retreating: false,
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
      knob.style.transform = 'translate(-50%, -50%)';
      knob.classList.remove('active');
    };

    const moveKnob = (clientX: number, clientY: number): void => {
      const cx = baseRect.left + baseRect.width  / 2;
      const cy = baseRect.top  + baseRect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
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

    // ── Waiting: emerge when triggered (Level 1 = first apple; others = gate + proximity) ─
    if (!snake.emerged) {
      let canEmerge: boolean;
      if (gameLevel === 1) {
        canEmerge = this.applesCollected > 0;   // any apple eaten → all snakes notice
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
      if (effectivelyHidden) {
        randomStep();
      } else {
        tryMove(gc.x, gc.y);
      }

    } else if (snake.behavior === 'hunter') {
      // 🔴 Hunter Snake: hyper-aggressive chaser — already scaled by apple factor in tickMs;
      //    uses 80% chase / 20% random to avoid getting permanently wall-stuck
      if (effectivelyHidden) {
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
      if (!effectivelyHidden && distFromPlayer <= 4) {
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
      if (effectivelyHidden) {
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
      if (!effectivelyHidden && distFromPlayer < 7) {
        // Player is close — chase them
        tryMove(gc.x, gc.y);
      } else if (distFromExit > 6) {
        // Drifted too far from post — return
        tryMove(exitX, exitY);
      } else {
        // Patrol: random walk within guard radius
        randomStep();
      }
    } else {
      // 'chaser' (default): always chase Glory, random walk when hidden
      if (effectivelyHidden) {
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
    if (this.joystickActive && this.dragDir) {
      // Base speed capped at 1.2 px/frame; reversed for Mirror Maze
      const rev = LEVEL_CONFIGS[gameLevel - 1].reversedControls ? -1 : 1;
      const baseSpd = Math.min(this.glory.speed, 1.2);
      const spd = this.activePowerUp?.kind === 'speed'
        ? baseSpd * 1.8
        : baseSpd;

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

    // Level 1 start gate: open when Glory walks past col 4
    if (gameLevel === 1 && !this.gateOpen) {
      const gc1 = this.gloryCell();
      if (gc1.x >= 1) {
        this.gateOpen = true;
        this.gateOpenAnimMs = 0;
      }
    }
    if (this.gateOpenAnimMs < 800) this.gateOpenAnimMs += delta;
    if (this.exitGateOpenAnimMs >= 0 && this.exitGateOpenAnimMs < 800) this.exitGateOpenAnimMs += delta;

    // Trigger hide challenge when entering a bush (Level 1 or any level with bushes)
    if (this.hiddenInBush && !this.challengeActive && !this.bushChallengeAnswered
        && this.bushCells.size > 0 && gameLevel === 1) {
      this.triggerHideChallenge();
    }

    this.gloryTrail.unshift({ x: this.glory.x, y: this.glory.y });
    if (this.gloryTrail.length > this.gloryTrailMax) this.gloryTrail.pop();

    // Per-snake tick accumulator (levels with snakeEnemyConfigs)
    if (this.usePerSnakeTick) {
      const gc3 = this.gloryCell();
      for (const snake of this.snakes) {
        if (!snake.alive || snake.stunnedMs > 0) continue;
        snake.tickAccumMs += delta;
        while (snake.tickAccumMs >= snake.tickMs) {
          snake.tickAccumMs -= snake.tickMs;
          this.moveSnakeStep(snake, gc3);
        }
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

    // Power-up timer
    if (this.activePowerUp && this.activePowerUp.kind !== 'trap') {
      this.activePowerUp.msRemaining -= delta;
      if (this.activePowerUp.msRemaining <= 0) this.activePowerUp = null;
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

        // Level 1: track apple count + progressively speed up snakes
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
      this.winGame();
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
    // Snakes can't find Glory when she is successfully hidden
    if (this.hiddenInBush && this.hidingSuccess) return;
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

  private triggerHideChallenge(): void {
    const riddle = CHALLENGES[10 + Math.floor(Math.random() * 5)];
    this.pendingHideChallenge = riddle;
    this.challengeActive = true;
    this.bushChallengeAnswered = true;   // mark so we don't re-trigger this visit
    this.challengeType = 'hide';
    this.challengeTimerMs = 0;
    this.snakeTickTimer?.remove();

    const overlay = document.getElementById('challenge-overlay');
    const badge = overlay?.querySelector('.challenge-badge');
    const hint = overlay?.querySelector('.challenge-hint');
    const qEl = document.getElementById('challenge-question');
    const choicesEl = document.getElementById('challenge-choices');
    const bar = document.getElementById('challenge-timer-bar');

    if (badge) badge.textContent = '🏕️ Shelter Riddle';
    if (hint) hint.textContent = `Answer correctly to stay hidden — get it wrong and the snakes find you!`;
    if (qEl) qEl.textContent = riddle.q;
    if (bar) bar.style.width = '100%';

    if (choicesEl) {
      choicesEl.innerHTML = '';
      riddle.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.className = 'challenge-choice-btn';
        btn.textContent = choice;
        btn.addEventListener('click', () => { this.answerHideChallenge(idx); });
        choicesEl.appendChild(btn);
      });
    }

    overlay?.classList.remove('hidden');
  }

  private answerHideChallenge(idx: number): void {
    if (!this.challengeActive || !this.pendingHideChallenge) return;
    const correct = idx === this.pendingHideChallenge.answer;
    if (correct) {
      this.hideAttemptCount = 0;
      this.dismissHideChallenge(true);
      return;
    }

    // Wrong answer — allow up to 3 tries on the same question
    this.hideAttemptCount++;
    if (this.hideAttemptCount >= 3) {
      // Used all 3 tries → dismiss with penalty; next tree entry gets a fresh question
      this.hideAttemptCount = 0;
      this.bushChallengeAnswered = false;  // allow re-trigger with new riddle
      this.dismissHideChallenge(false);
    } else {
      // Flash feedback and keep the same question open
      const remaining = 3 - this.hideAttemptCount;
      const hint = document.querySelector<HTMLElement>('#challenge-overlay .challenge-hint');
      if (hint) hint.textContent = `❌ Wrong! ${remaining} attempt${remaining !== 1 ? 's' : ''} left…`;

      // Briefly flash all choice buttons red
      document.querySelectorAll<HTMLElement>('.challenge-choice-btn').forEach(btn => {
        btn.style.background = '#cc2222';
        btn.style.color = '#fff';
        setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 450);
      });
    }
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
    this.pendingHideChallenge = null;
    this.challengeTimerMs = 0;
    this.challengeType = null;

    document.getElementById('challenge-overlay')?.classList.add('hidden');

    if (!this.roundOver) {
      const config = LEVEL_CONFIGS[gameLevel - 1];
      const tickMs = Math.max(80, Math.floor(config.snakeTickMs / this.speedRampFactor));
      this.startSnakeTimer(tickMs);
    }
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
  private readonly POWER_UP_ROTATION: PowerUpKind[] = ['flashlight', 'trap', 'speed', 'hint'];
  private readonly POWER_UP_LABELS: Record<PowerUpKind, string> = {
    flashlight: '🔦 Flashlight',
    trap: '🪤 Trap',
    speed: '⚡ Speed Boost',
    hint: '💡 Hint',
    pistol: '🔫 Pistol',
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
    } else {
      const durations: Record<PowerUpKind, number> = { flashlight: 8000, trap: 0, speed: 6000, hint: 4000, pistol: 0 };
      this.activePowerUp = { kind, msRemaining: durations[kind] };
    }
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
    if (gameLevel === 1) {
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
    if (gameLevel === 1) { this.drawSpawnBushes(); this.drawStartGate(); this.drawExitGate(); }
    this.drawPistolPickups();
    this.drawExitZone();
    this.drawPoisonTiles();
    this.drawIQGates();
    this.drawSnakes();
    this.drawBullets();

    if (this.activePowerUp?.kind === 'flashlight') {
      this.overlayGraphics.fillStyle(0x000000, 0.86);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
      this.overlayGraphics.lineStyle(3, 0xffee88, 0.4);
      this.overlayGraphics.strokeCircle(this.glory.x, this.glory.y, 82);
    }

    if (this.fogOfWar) {
      this.drawFogOfWar();
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

      // Apple shadow
      this.bgGraphics.fillStyle(0x000000, 0.2);
      this.bgGraphics.fillEllipse(cx + 1, cy + 7, 12, 5);

      // Apple body — deep red gradient suggestion (two-tone)
      this.bgGraphics.fillStyle(0xcc1111);
      this.bgGraphics.fillCircle(cx, cy + 1, 7);
      this.bgGraphics.fillStyle(0xff3333, 0.5);
      this.bgGraphics.fillCircle(cx - 1, cy, 5);

      // Apple indent at top
      this.bgGraphics.fillStyle(0x990000, 0.8);
      this.bgGraphics.fillCircle(cx, cy - 5, 2.5);

      // Stem
      this.bgGraphics.fillStyle(0x5c3a1e);
      this.bgGraphics.fillRect(cx - 0.5, cy - 8, 1.5, 4);

      // Leaf
      this.bgGraphics.fillStyle(0x2d8c22);
      this.bgGraphics.fillEllipse(cx + 4, cy - 7, 9, 5);
      // Leaf vein
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
  }

  // ── Pistol pickups and bullets ───────────────────────────────────────────
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

      if (gameLevel === 1) {
        // Level 1: draw as a large hiding tree
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

  // ── Level 1: Clean Mountain Path background ──────────────────────────────
  private drawLevel1Background(): void {
    const g = this.bgGraphics;

    // Key pixel positions for Z-path walls:
    //   Upper corridor:  rows 5-8   (walls at row 4 top, row 9 bottom; cliff ledge row 6 inner, cols 9-13)
    //   Dead-end alcove: cols 4-8, rows 9-12 (gap in bottom wall, col 3 left, col 9 right, row 13 floor)
    //   Connector:       cols 17-19 (walls at col 20 right, col 16 left; cliff narrow col 17 rows 12-14)
    //   Lower corridor:  rows 19-21 (walls at row 18 top, row 22 bottom; S-curve inner walls)
    const upTopY = 4  * CELL_SIZE;  // 80
    const upBotY = 9  * CELL_SIZE;  // 180
    const loTopY = 18 * CELL_SIZE;  // 360
    const loBotY = 22 * CELL_SIZE;  // 440
    const connLX = 16 * CELL_SIZE;  // 320
    const connRX = 20 * CELL_SIZE;  // 400
    // Dead-end alcove pixel boundaries (cols 4-8 open, rows 9-12 interior)
    const alcoveX  = 4 * CELL_SIZE;   // x=80  (left open edge, col 4)
    const alcoveX2 = 9 * CELL_SIZE;   // x=180 (right wall, col 9)
    const alcoveY2 = 13 * CELL_SIZE;  // y=260 (bottom wall, row 13)
    // Narrow cliff ledge in upper corridor (cols 9-13 inner ceiling at row 6)
    const cliffX1  = 9  * CELL_SIZE;  // x=180
    const cliffX2  = 14 * CELL_SIZE;  // x=280
    const cliffTopY = 6 * CELL_SIZE;  // y=120 (inner ceiling row 6)

    // ── 1. Full canvas base: rocky cliff color ───────────────────────
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

    // Dead-end alcove floor (reward pocket, cols 4-8, rows 9-12)
    g.fillStyle(0xd4c07a);  // slightly darker sand — hints at hidden area
    g.fillRect(alcoveX, upBotY, alcoveX2 - alcoveX, alcoveY2 - upBotY);

    // Narrow cliff ledge: rocky overlay for sealed-off upper area (rows 4-5, cols 9-13)
    g.fillStyle(0x5c4a30, 0.72);
    g.fillRect(cliffX1, upTopY, cliffX2 - cliffX1, cliffTopY - upTopY);
    // Strata lines on cliff face above ledge
    g.fillStyle(0x3e3020, 0.5);
    for (let ry = upTopY + 6; ry < cliffTopY; ry += 10) {
      g.fillRect(cliffX1, ry, cliffX2 - cliffX1, 3);
    }

    // Connector narrow-cliff rocky patch: sealed-off strip at col 17, rows 12-14
    g.fillStyle(0x5c4a30, 0.7);
    g.fillRect(connLX + CELL_SIZE, 12 * CELL_SIZE, CELL_SIZE, 3 * CELL_SIZE);

    // S-curve rocky patches in lower corridor
    // Upper cutoff (row 19, cols 21-24 = top half of S blocked)
    g.fillStyle(0x5c4a30, 0.65);
    g.fillRect(21 * CELL_SIZE, loTopY, 4 * CELL_SIZE, CELL_SIZE);
    // Lower cutoff (row 21, cols 25-29 = bottom half of S blocked)
    g.fillRect(25 * CELL_SIZE, loBotY - 2 * CELL_SIZE, 5 * CELL_SIZE, CELL_SIZE);

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
    // Upper segment bottom fence — split around dead-end alcove opening (gap at cols 4-8)
    fenceH(CELL_SIZE,    alcoveX,  upBotY);  // cols 1-3  (x 20-80)
    fenceH(alcoveX2, 16 * CELL_SIZE, upBotY); // cols 9-15 (x 180-320)
    // Narrow cliff inner ceiling fence (row 6, cols 9-13 = x 180-280)
    fenceH(cliffX1, cliffX2, cliffTopY);
    // Dead-end alcove walls
    fenceV(3 * CELL_SIZE, upBotY, alcoveY2);          // alcove left  (col 3, rows 9-12)
    fenceV(alcoveX2,      upBotY, alcoveY2);          // alcove right (col 9, rows 9-12)
    fenceH(3 * CELL_SIZE, alcoveX2, alcoveY2);        // alcove floor (row 13, cols 3-9)
    // Connector right fence      (col 20, rows 5-17 = y 100-340)
    fenceV(connRX, upTopY + CELL_SIZE, loTopY);
    // Connector left fence       (col 16, rows 10-17 = y 200-340)
    fenceV(connLX, upBotY + CELL_SIZE, loTopY);
    // Connector narrow cliff     (col 17, rows 12-14 = y 240-300)
    fenceV(connLX + CELL_SIZE, 12 * CELL_SIZE, 15 * CELL_SIZE);
    // Lower segment top fence    (row 18, cols 20-31 = x 400-620)
    fenceH(connRX, CANVAS_W - CELL_SIZE, loTopY);
    // Lower segment bottom fence (row 22, cols 16-31 = x 320-620)
    fenceH(connLX, CANVAS_W - CELL_SIZE, loBotY);
    // Lower segment left fence   (col 16, rows 19-21 = y 380-420)
    fenceV(connLX, loTopY + CELL_SIZE, loBotY);
    // S-curve inner fences (lower corridor winding path)
    fenceH(21 * CELL_SIZE, 25 * CELL_SIZE, 19 * CELL_SIZE); // row 19, cols 21-24
    fenceH(25 * CELL_SIZE, 30 * CELL_SIZE, 21 * CELL_SIZE); // row 21, cols 25-29

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
    // Narrow cliff ledge entry warning (just before cliff ceiling drops, col 8-9)
    warnSign(cliffX1 - CELL_SIZE / 2, upTopY + (cliffTopY - upTopY) / 2);
    // Dead-end alcove entrance warning (hint: something is down there!)
    warnSign(alcoveX + (alcoveX2 - alcoveX) / 2, upBotY + 10);

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

  private drawBackground(): void {
    // Level 1 uses its own clean visual design
    if (gameLevel === 1) { this.drawLevel1Background(); return; }

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
      for (let i = n - 1; i >= 1; i--) {
        const segA = segs[i];       // current (tail side)
        const segB = segs[i - 1];   // next toward head

        const ax = segA.x * CELL_SIZE + CELL_SIZE / 2;
        const ay = segA.y * CELL_SIZE + CELL_SIZE / 2;
        const bx = segB.x * CELL_SIZE + CELL_SIZE / 2;
        const by = segB.y * CELL_SIZE + CELL_SIZE / 2;

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

    // When successfully hidden inside a shelter, draw semi-transparent
    const alpha = (this.hiddenInBush && this.hidingSuccess) ? 0.30 : 1.0;

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
