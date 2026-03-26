import Phaser from 'phaser';
import type { ThreeEffects } from './three-effects';

export interface GameController { destroy(): void; }

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;

type GameMode = 'explorer' | 'survivor' | 'legend';

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
}

const LEVEL_CONFIGS: Record<GameMode, LevelConfig[]> = {
  explorer: [
    // Explorer L1: Basic Movement — straight corridor
    {
      name: 'Basic Movement',
      survivalGoal: 999, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [
        ...hwall(9,  4, 29), ...hwall(10, 4, 29),
        ...hwall(14, 4, 29), ...hwall(15, 4, 29),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[6,11],[9,13],[12,11],[15,13],[18,11],[21,13],[24,11],[27,13]],
      bushes: [[4,12],[8,10],[16,14],[22,12]],
    },
    // Explorer L2: Food Collection — open field, exit top-right
    {
      name: 'Food Collection',
      survivalGoal: 999, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [
        ...hwall(1,  1, 30), ...hwall(22, 1, 30),
        ...vwall(1,  1, 22), ...vwall(30, 1, 22),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 20 },
      exitZone:   { col: 30, row: 4 },
      collectibles: [[5,5],[9,5],[13,5],[17,5],[21,5],[25,5],[5,11],[9,11],[13,11],[17,11],[21,11],[25,11],[5,17],[9,17],[13,17],[17,17]],
      bushes: [[3,10],[8,8],[15,14],[22,8]],
    },
    // Explorer L3: Simple Turns + Fences — L-shaped path
    {
      name: 'Simple Turns',
      survivalGoal: 999, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [
        ...hwall(8,  1, 20), ...hwall(16, 1, 14),
        ...hwall(16, 21, 30), ...hwall(22, 14, 30),
        ...vwall(20, 8, 16), ...vwall(14, 16, 22),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 20 },
      exitZone:   { col: 30, row: 4 },
      collectibles: [[5,20],[5,15],[10,20],[10,9],[15,9],[20,12],[20,18],[25,18],[25,6],[28,6]],
      bushes: [[3,15],[6,12],[14,8],[20,15]],
    },
    // Explorer L4: First Small Maze — Z-path
    {
      name: 'First Small Maze',
      survivalGoal: 999, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [
        ...hwall(6,  4, 16), ...hwall(6,  18, 28),
        ...hwall(12, 10, 22), ...hwall(18, 4, 14),
        ...hwall(18, 16, 28),
        ...vwall(4,  6, 18), ...vwall(16, 12, 18),
        ...vwall(22, 6, 12), ...vwall(28, 6, 18),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[6,12],[10,8],[14,15],[18,12],[22,8],[26,15],[28,12]],
    },
    // Explorer L5: Mini Challenge — wide corridor, 1 slow enemy
    {
      name: 'Mini Challenge',
      survivalGoal: 999, snakeCount: 1, snakeTickMs: 480, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [
        ...hwall(8,  4, 28), ...hwall(9,  4, 28),
        ...hwall(15, 4, 28), ...hwall(16, 4, 28),
        ...vwall(4,  8, 16), ...vwall(28, 8, 16),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[7,11],[10,13],[13,11],[16,13],[19,11],[22,13],[25,11]],
    },
  ],
  survivor: [
    // Survivor L1: Intro Survival — wide open, 1 enemy
    {
      name: 'Intro Survival',
      survivalGoal: 999, snakeCount: 1, snakeTickMs: 320, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...vwall(15, 4, 8), ...vwall(15, 16, 20),
        ...hwall(4,  4, 14), ...hwall(20, 14, 28),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[8,8],[8,16],[12,12],[18,8],[18,16],[25,12]],
    },
    // Survivor L2: Narrow Path Control — 2-wide corridor
    {
      name: 'Narrow Path Control',
      survivalGoal: 999, snakeCount: 1, snakeTickMs: 300, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(9,  3, 29),
        ...hwall(15, 3, 29), ...hwall(16, 3, 29),
        ...hwall(11, 8, 16), ...hwall(12, 8, 16),
        ...hwall(11, 19, 24), ...hwall(12, 19, 24),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[10,13],[15,12],[20,13],[25,12]],
    },
    // Survivor L3: Bamboo Bridge — 2-cell wide bridge
    {
      name: 'Bamboo Bridge',
      survivalGoal: 999, snakeCount: 1, snakeTickMs: 300, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(9,  3, 29), ...hwall(10, 3, 29),
        ...hwall(13, 3, 29), ...hwall(14, 3, 29), ...hwall(15, 3, 29),
        ...vwall(7,  8, 13), ...vwall(13, 8, 13),
        ...vwall(19, 8, 13), ...vwall(25, 8, 13),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 11 },
      exitZone:   { col: 30, row: 11 },
      collectibles: [[5,11],[8,12],[11,11],[14,12],[17,11],[20,12],[23,11],[26,12]],
    },
    // Survivor L4: Split Path — upper and lower routes
    {
      name: 'Split Path',
      survivalGoal: 999, snakeCount: 1, snakeTickMs: 280, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...vwall(8,  4, 10), ...vwall(8,  14, 20),
        ...hwall(4,  8, 22), ...hwall(20, 8, 22),
        ...vwall(22, 4, 10), ...vwall(22, 14, 20),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,7],[10,7],[16,7],[22,7],[28,7],[4,17],[10,17],[16,17],[22,17],[28,17]],
    },
    // Survivor L5: First Hunter — S-curve, 2 enemies
    {
      name: 'First Hunter',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 250, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...hwall(6,  4, 18), ...hwall(12, 10, 22),
        ...hwall(18, 16, 28), ...hwall(21, 4, 16),
        ...hwall(9,  16, 28),
        ...vwall(18, 6, 12), ...vwall(10, 12, 18),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 18 },
      exitZone:   { col: 30, row: 6 },
      collectibles: [[4,18],[7,15],[10,18],[13,15],[16,12],[19,9],[22,6],[25,9],[28,6]],
    },
    // Survivor L6: Dark Forest — fog, breadcrumb trail, 2 enemies
    {
      name: 'Dark Forest',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 260, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: true,
      walls: [
        ...vwall(6,  5, 8),  ...vwall(6,  16, 19),
        ...vwall(12, 8, 11), ...vwall(12, 13, 16),
        ...vwall(18, 5, 8),  ...vwall(18, 16, 19),
        ...vwall(24, 8, 11), ...vwall(24, 13, 16),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,12],[7,11],[10,12],[13,11],[16,12],[19,11],[22,12],[25,11],[28,12]],
    },
    // Survivor L7: Speed + Obstacles — staggered obstacles, 2 fast enemies
    {
      name: 'Speed + Obstacles',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 200, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...hwall(6,  4,  8), ...hwall(6,  12, 16), ...hwall(6,  20, 24),
        ...hwall(10, 8, 12), ...hwall(10, 16, 20),
        ...hwall(14, 4,  8), ...hwall(14, 12, 16), ...hwall(14, 20, 24),
        ...hwall(18, 8, 12), ...hwall(18, 16, 20),
        ...hwall(22, 4,  8), ...hwall(22, 12, 16), ...hwall(22, 20, 24),
        ...hwall(26, 8, 12), ...hwall(26, 16, 20),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[3,12],[6,9],[9,12],[12,15],[15,12],[18,9],[21,12],[24,15],[27,12]],
    },
    // Survivor L8: Maze Survival — full maze, 2 enemies
    {
      name: 'Maze Survival',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 220, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
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
      collectibles: [[2,5],[5,12],[8,18],[11,5],[14,12],[17,18],[20,5],[23,12],[26,18],[29,12]],
    },
    // Survivor L9: Multiple Enemies — pillar grid, 4 enemies
    {
      name: 'Multiple Enemies',
      survivalGoal: 999, snakeCount: 4, snakeTickMs: 210, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...vwall(8,  4,  6), ...vwall(8,  18, 20),
        ...vwall(14, 8, 10), ...vwall(14, 14, 16),
        ...vwall(20, 4,  6), ...vwall(20, 18, 20),
        ...vwall(26, 8, 10), ...vwall(26, 14, 16),
        ...hwall(6,  4,  8), ...hwall(6,  20, 24),
        ...hwall(18, 10, 14),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,12],[8,8],[8,16],[14,12],[20,8],[20,16],[26,12]],
    },
    // Survivor L10: Boss Stage — arena + inner obstacles
    {
      name: 'Boss Stage',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 220, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [
        ...hwall(3,  3, 29), ...hwall(21, 3, 29),
        ...vwall(3,  3, 21), ...vwall(29, 3, 21),
        ...hwall(9,  9, 15), ...hwall(9,  17, 23),
        ...hwall(15, 9, 15), ...hwall(15, 17, 23),
        ...vwall(9,  9, 15), ...vwall(23, 9, 15),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: true, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[10,6],[10,18],[16,6],[16,18],[22,6],[22,18],[25,12]],
    },
  ],
  legend: [
    // Legend L1: Fast Start — wide corridor, 2 fast enemies
    {
      name: 'Fast Start',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 200, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(16, 3, 29),
        ...vwall(3,  8, 16), ...vwall(29, 8, 16),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[9,11],[13,13],[17,11],[21,13],[25,11],[28,12]],
    },
    // Legend L2: Tight Corridor — 2-cell wide, pinch points
    {
      name: 'Tight Corridor',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(10, 3, 29), ...hwall(11, 3, 29),
        ...hwall(13, 3, 29), ...hwall(14, 3, 29),
        ...vwall(8,  10, 14), ...vwall(14, 10, 14),
        ...vwall(20, 10, 14), ...vwall(26, 10, 14),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[9,12],[13,12],[17,12],[21,12],[25,12]],
    },
    // Legend L3: Double Enemy Chase — winding corridor, 3 fast enemies
    {
      name: 'Double Enemy Chase',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 180, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 16), ...hwall(16, 14, 28),
        ...hwall(4,  18, 28),
        ...vwall(16, 8, 16), ...vwall(3, 8, 18),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 20 },
      exitZone:   { col: 30, row: 4 },
      collectibles: [[3,20],[6,16],[9,12],[12,8],[15,8],[18,12],[21,16],[24,12],[27,8],[29,5]],
    },
    // Legend L4: IQ Gate Traps — straight path blocked by IQ gates
    {
      name: 'IQ Gate Traps',
      survivalGoal: 999, snakeCount: 2, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(9,  3, 29), ...hwall(15, 3, 29),
      ],
      poisonTiles: [],
      iqGatePositions: [
        { col: 10, row: 12, challengeIdx: 0 },
        { col: 16, row: 12, challengeIdx: 3 },
        { col: 22, row: 12, challengeIdx: 7 },
      ],
      movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,11],[5,13],[13,11],[13,13],[19,11],[19,13],[27,11],[27,13]],
    },
    // Legend L5: Maze + Blind Corners — fog, 3 enemies
    {
      name: 'Maze + Blind Corners',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [
        ...hwall(4,  2, 14), ...hwall(4,  16, 30),
        ...hwall(10, 6, 18), ...hwall(16, 2, 12),
        ...hwall(16, 14, 28), ...hwall(22, 6, 20),
        ...vwall(6,  4, 10), ...vwall(12, 10, 16),
        ...vwall(18, 4, 10), ...vwall(24, 10, 22),
        ...vwall(28, 4, 16),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 1 },
      exitZone:   { col: 30, row: 22 },
      collectibles: [[3,5],[6,12],[9,18],[14,5],[18,12],[22,18],[27,12]],
    },
    // Legend L6: Speed Ramp — straight corridor, enemies speed up, 3 enemies
    {
      name: 'Speed Ramp',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 200, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(9,  3, 29),
        ...hwall(15, 3, 29), ...hwall(16, 3, 29),
        ...vwall(8,  8, 16),
        ...vwall(14, 8, 10), ...vwall(14, 14, 16),
        ...vwall(20, 8, 10), ...vwall(20, 14, 16),
        ...vwall(26, 8, 16),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: true,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[9,11],[13,13],[17,11],[21,13],[25,12]],
    },
    // Legend L7: Poison Zones — path through poisoned areas, 3 enemies
    {
      name: 'Poison Zones',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(16, 3, 29),
      ],
      poisonTiles: [
        [6,10],[6,11],[6,13],[6,14],
        [11,10],[11,11],[11,13],[11,14],
        [16,10],[16,11],[16,13],[16,14],
        [21,10],[21,11],[21,13],[21,14],
        [26,10],[26,11],[26,13],[26,14],
      ] as [number, number][],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,12],[8,12],[14,12],[19,12],[24,12],[28,12]],
    },
    // Legend L8: Multi-Path Traps — two paths with IQ gates, 3 enemies
    {
      name: 'Multi-Path Traps',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...vwall(14, 4, 10), ...vwall(14, 14, 20),
        ...hwall(4,  14, 28), ...hwall(20, 4, 14),
        ...hwall(8,  3, 13), ...hwall(8,  15, 29),
        ...hwall(16, 3, 13), ...hwall(16, 15, 29),
      ],
      poisonTiles: [],
      iqGatePositions: [
        { col: 8,  row: 12, challengeIdx: 4 },
        { col: 20, row: 12, challengeIdx: 8 },
      ],
      movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,7],[8,7],[12,7],[16,7],[20,7],[24,7],[28,7],[4,17],[8,17],[12,17]],
    },
    // Legend L9: Limited Vision + Enemies — fog + poison, 4 enemies
    {
      name: 'Limited Vision',
      survivalGoal: 999, snakeCount: 4, snakeTickMs: 185, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [
        ...hwall(6,  3, 16), ...hwall(18, 14, 29),
        ...vwall(16, 3, 14), ...vwall(3,  6, 18),
      ],
      poisonTiles: [
        [5,10],[5,11],[5,13],[5,14],
        [10,10],[10,14],
        [20,10],[20,14],
        [25,10],[25,11],[25,13],[25,14],
      ] as [number, number][],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,12],[8,8],[12,12],[16,8],[20,12],[24,8],[28,12]],
    },
    // Legend L10: Mini Boss Arena — small arena, boss + 3 enemies
    {
      name: 'Mini Boss Arena',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(4,  3, 29), ...hwall(20, 3, 29),
        ...vwall(3,  4, 20), ...vwall(29, 4, 20),
        ...hwall(10, 6, 14), ...hwall(10, 18, 22),
        ...hwall(14, 6, 14), ...hwall(14, 18, 22),
        ...vwall(8,  10, 14), ...vwall(22, 10, 14),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: true, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,7],[5,17],[16,7],[16,17],[25,7],[25,17]],
    },
    // Legend L11: Moving Obstacles — corridor with moving walls, 3 enemies
    {
      name: 'Moving Obstacles',
      survivalGoal: 999, snakeCount: 3, snakeTickMs: 185, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(8,  3, 29), ...hwall(16, 3, 29),
      ],
      poisonTiles: [], iqGatePositions: [],
      movingWallConfigs: [
        { col: 8,  row: 12, col2: 8,  row2: 10, intervalMs: 3000 },
        { col: 16, row: 12, col2: 16, row2: 14, intervalMs: 4000 },
        { col: 22, row: 12, col2: 22, row2: 10, intervalMs: 3500 },
      ],
      hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[4,12],[7,11],[11,13],[15,11],[19,13],[23,11],[27,12]],
    },
    // Legend L12: High-Speed Chase — straight, 4 fast enemies
    {
      name: 'High-Speed Chase',
      survivalGoal: 999, snakeCount: 4, snakeTickMs: 160, glorySpeed: 3.5, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(10, 3, 29), ...hwall(11, 3, 29),
        ...hwall(13, 3, 29), ...hwall(14, 3, 29),
      ],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[10,11],[15,13],[20,11],[25,13],[28,12]],
    },
    // Legend L13: IQ + Movement Combo — maze + IQ gates + fog, 4 enemies
    {
      name: 'IQ + Move Combo',
      survivalGoal: 999, snakeCount: 4, snakeTickMs: 175, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [
        ...hwall(6,  3, 18), ...hwall(6,  20, 29),
        ...hwall(14, 8, 22),
        ...vwall(18, 6, 14), ...vwall(12, 12, 20),
      ],
      poisonTiles: [],
      iqGatePositions: [
        { col: 9,  row: 12, challengeIdx: 2 },
        { col: 15, row: 12, challengeIdx: 5 },
        { col: 24, row: 12, challengeIdx: 9 },
      ],
      movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [] as [number,number][],
    },
    // Legend L14: Almost No Safe Zones — poison tiles + maze + 5 enemies
    {
      name: 'No Safe Zones',
      survivalGoal: 999, snakeCount: 5, snakeTickMs: 175, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [
        ...hwall(4,  4, 28), ...hwall(20, 4, 28),
        ...vwall(4,  4, 20), ...vwall(28, 4, 20),
        ...hwall(8,  8, 24), ...hwall(16, 8, 24),
        ...vwall(8,  8, 16), ...vwall(24, 8, 16),
      ],
      poisonTiles: [
        [4,6],[5,6],[6,6],[7,6],
        [8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],
        [4,18],[5,18],[6,18],[7,18],
        [8,17],[9,17],[10,17],[11,17],[12,17],[13,17],[14,17],[15,17],
        [16,6],[17,6],[18,6],[19,6],[20,6],[21,6],[22,6],
        [16,18],[17,18],[18,18],[19,18],[20,18],[21,18],[22,18],
      ] as [number, number][],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[10,10],[15,12],[20,10],[25,12]],
    },
    // Legend L15: FINAL VENOM ARENA — all mechanics
    {
      name: 'FINAL VENOM ARENA',
      survivalGoal: 999, snakeCount: 7, snakeTickMs: 165, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [
        ...hwall(4,  2, 10), ...hwall(4,  16, 28),
        ...hwall(8,  4, 14), ...hwall(8,  18, 28),
        ...hwall(14, 2,  8), ...hwall(14, 20, 28),
        ...hwall(20, 4, 14), ...hwall(20, 18, 26),
        ...vwall(4,  4,  8), ...vwall(4,  14, 20),
        ...vwall(12, 6, 12), ...vwall(12, 14, 20),
        ...vwall(20, 4,  8), ...vwall(20, 16, 20),
        ...vwall(28, 6, 14), ...vwall(16, 8, 12),
      ],
      poisonTiles: [
        [2,2],[3,2],[2,3],[3,3],
        [28,2],[29,2],[30,2],[29,3],
        [2,20],[3,20],[2,21],[3,21],
        [28,20],[29,20],[30,20],[29,21],
        [14,12],[15,12],[16,12],[14,13],[15,13],
        [8,8],[9,8],[8,9],[9,9],
      ] as [number, number][],
      iqGatePositions: [
        { col: 11, row: 4,  challengeIdx: 9 },
        { col: 15, row: 4,  challengeIdx: 0 },
        { col: 21, row: 4,  challengeIdx: 1 },
      ],
      movingWallConfigs: [
        { col: 16, row: 8,  col2: 16, row2: 10, intervalMs: 4000 },
        { col: 4,  row: 8,  col2: 6,  row2: 8,  intervalMs: 5000 },
        { col: 28, row: 14, col2: 26, row2: 14, intervalMs: 4500 },
        { col: 12, row: 12, col2: 12, row2: 14, intervalMs: 6000 },
      ],
      hasBoss: true, speedRamp: true,
      gloryStart: { col: 1, row: 12 },
      exitZone:   { col: 30, row: 12 },
      collectibles: [[5,12],[10,6],[16,10],[22,6],[25,12]] as [number,number][],
    },
  ],
};

let gameMode: GameMode = 'explorer';
let gameLevel: number = 1;

type PowerUpKind = 'flashlight' | 'trap' | 'speed' | 'hint';

interface Point { x: number; y: number; }

interface SnakeEnemy {
  id: number;
  segments: Point[];
  alive: boolean;
  stunnedMs: number;
  color: number;
  isBoss: boolean;
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

const SNAKE_COLORS = [0xff4444, 0xff8800, 0xffcc00, 0xff44cc, 0x44bbff, 0xaa44ff, 0xff6688, 0x88ffaa];

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
  private threeEffects: ThreeEffects | null = null;

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private topGraphics!: Phaser.GameObjects.Graphics;

  private overlayText!: Phaser.GameObjects.Text;

  private joystickActive = false;
  private dragDir: { dx: number; dy: number } | null = null;
  private gloryTrail: Array<{x: number; y: number}> = [];
  private readonly TRAIL_LENGTH = 6;

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
  private exitPulseTimer = 0;

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

    const container = document.getElementById('game-root');
    if (container) {
      import('./three-effects').then(({ createThreeEffects }) => {
        this.threeEffects = createThreeEffects(container, CANVAS_W, CANVAS_H);
      }).catch(() => { /* Three.js optional */ });
    }
  }

  private initGame(): void {
    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];

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

    this.snakes = [];
    for (let i = 0; i < config.snakeCount; i++) {
      this.spawnSnake();
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

    // Initialize IQ gates
    this.iqGates = config.iqGatePositions.map(g => ({
      col: g.col,
      row: g.row,
      open: false,
      challenge: CHALLENGES[g.challengeIdx % CHALLENGES.length],
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
    this.exitPulseTimer = 0;

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
    this.joystickActive = false;

    this.startSnakeTimer(config.snakeTickMs);
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

  private spawnSnake(isBoss = false): void {
    const id = this.snakes.length;
    const color = isBoss ? 0xff2200 : SNAKE_COLORS[id % SNAKE_COLORS.length];
    const edge = Math.floor(Math.random() * 4);
    let hx: number, hy: number;
    if (edge === 0)      { hx = Math.floor(Math.random() * COLS); hy = 0; }
    else if (edge === 1) { hx = COLS - 1; hy = Math.floor(Math.random() * ROWS); }
    else if (edge === 2) { hx = Math.floor(Math.random() * COLS); hy = ROWS - 1; }
    else                 { hx = 0; hy = Math.floor(Math.random() * ROWS); }

    const gc = this.gloryCell();
    if (Math.abs(hx - gc.x) < 5 && Math.abs(hy - gc.y) < 5) {
      hx = (hx + COLS / 2) % COLS;
      hy = (hy + ROWS / 2) % ROWS;
    }

    const segs: Point[] = [{ x: hx, y: hy }, { x: hx, y: hy }, { x: hx, y: hy }];
    this.snakes.push({ id, segments: segs, alive: true, stunnedMs: 0, color, isBoss });
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
  }

  private tickSnakes(): void {
    if (this.roundOver) return;
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
    let nx = head.x;
    let ny = head.y;

    if (this.hiddenInBush) {
      // Random walk — snakes lose track of Glory in bushes
      const dirs = [{dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1}];
      const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
      const candX = head.x + randomDir.dc;
      const candY = head.y + randomDir.dr;
      if (!this.isWallOrClosedGate(candX, candY)) {
        nx = candX;
        ny = candY;
      }
    } else {
      const dx = gc.x - head.x;
      const dy = gc.y - head.y;

      if (dx === 0 && dy === 0) {
        // Already on top — skip
      } else if (Math.abs(dx) >= Math.abs(dy)) {
        // Try X first
        const candX = head.x + Math.sign(dx);
        if (!this.isWallOrClosedGate(candX, head.y)) {
          nx = candX;
        } else {
          // Try Y
          const candY = head.y + Math.sign(dy !== 0 ? dy : 1);
          if (!this.isWallOrClosedGate(head.x, candY)) {
            ny = candY;
          }
          // else stay
        }
      } else {
        // Try Y first
        const candY = head.y + Math.sign(dy);
        if (!this.isWallOrClosedGate(head.x, candY)) {
          ny = candY;
        } else {
          // Try X
          const candX = head.x + Math.sign(dx !== 0 ? dx : 1);
          if (!this.isWallOrClosedGate(candX, head.y)) {
            nx = candX;
          }
          // else stay
        }
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
        this.dismissChallenge(false);
      }
      this.drawScene();
      return;
    }

    this.survivalMs += delta;
    this.spawnAccumMs += delta;

    // Periodic snake spawn
    if (this.spawnAccumMs >= this.SPAWN_INTERVAL_MS) {
      this.spawnAccumMs = 0;
      this.spawnSnake();
    }

    // Glory invincibility countdown
    if (this.glory.invincibleMs > 0) {
      this.glory.invincibleMs -= delta;
      if (this.glory.invincibleMs < 0) this.glory.invincibleMs = 0;
    }

    // Move Glory with wall collision
    if (this.joystickActive && this.dragDir) {
      const spd = this.activePowerUp?.kind === 'speed'
        ? this.glory.speed * 1.8
        : this.glory.speed;

      // X axis: try movement, block on wall
      const newX = this.glory.x + this.dragDir.dx * spd;
      const newXClamped = Math.max(12, Math.min(CANVAS_W - 12, newX));
      const newXCell = Math.max(0, Math.min(COLS - 1, Math.floor(newXClamped / CELL_SIZE)));
      const curYCell = Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE)));
      if (!this.isWallOrClosedGate(newXCell, curYCell)) {
        this.glory.x = newXClamped;
      }

      // Y axis: try movement, block on wall
      const newY = this.glory.y + this.dragDir.dy * spd;
      const newYClamped = Math.max(12, Math.min(CANVAS_H - 12, newY));
      const curXCell = Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE)));
      const newYCell = Math.max(0, Math.min(ROWS - 1, Math.floor(newYClamped / CELL_SIZE)));
      if (!this.isWallOrClosedGate(curXCell, newYCell)) {
        this.glory.y = newYClamped;
      }
    }

    // Update bush-hide state and glory trail
    const gloryCol = Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE)));
    const gloryRow = Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE)));
    this.hiddenInBush = this.bushCells.has(`${gloryCol},${gloryRow}`);
    this.gloryTrail.unshift({ x: this.glory.x, y: this.glory.y });
    if (this.gloryTrail.length > this.TRAIL_LENGTH) this.gloryTrail.pop();

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

    // IQ gate check
    if (!this.challengeActive) {
      const gc = this.gloryCell();
      for (const gate of this.iqGates) {
        if (!gate.open && gate.col === gc.x && gate.row === gc.y) {
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
    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];
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
        this.threeEffects?.triggerEvent('food', c.col * CELL_SIZE + CELL_SIZE / 2, c.row * CELL_SIZE + CELL_SIZE / 2);
      }
    }

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

    if (this.threeEffects && !this.roundOver) {
      this.threeEffects.update({
        snakeHeads: this.snakes.map(s => ({
          x: s.segments[0].x * CELL_SIZE + CELL_SIZE / 2,
          y: s.segments[0].y * CELL_SIZE + CELL_SIZE / 2,
          color: s.color,
        })),
        foodPositions: this.collectibles
          .filter(c => !c.collected)
          .map(c => ({ x: c.col * CELL_SIZE + CELL_SIZE / 2, y: c.row * CELL_SIZE + CELL_SIZE / 2 })),
        exitZone: this.exitZone
          ? { x: this.exitZone.col * CELL_SIZE + CELL_SIZE / 2, y: this.exitZone.row * CELL_SIZE + CELL_SIZE / 2 }
          : null,
        elapsed: this.survivalMs,
      });
    }
  }

  private checkCollision(): void {
    const gc = this.gloryCell();
    for (const snake of this.snakes) {
      if (!snake.alive || snake.stunnedMs > 0) continue;
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

  private answerChallenge(idx: number): void {
    if (!this.challengeActive || !this.pendingIQGate) return;
    const correct = idx === this.pendingIQGate.challenge.answer;
    this.dismissChallenge(correct);
  }

  private dismissChallenge(correct: boolean): void {
    if (this.pendingIQGate) {
      if (correct) {
        this.pendingIQGate.open = true;
        // Remove gate position from walls
        this.walls.delete(`${this.pendingIQGate.col},${this.pendingIQGate.row}`);
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
      const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];
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
      const durations: Record<PowerUpKind, number> = { flashlight: 8000, trap: 0, speed: 6000, hint: 4000 };
      this.activePowerUp = { kind, msRemaining: durations[kind] };
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

    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];
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

  // ── Drawing ────────────────────────────────────────────────────────────────
  private drawScene(): void {
    this.bgGraphics.clear();
    this.topGraphics.clear();
    this.overlayGraphics.clear();

    this.drawBackground();
    this.drawCollectibles();
    this.drawBushes();
    this.drawExitZone();
    this.drawPoisonTiles();
    this.drawIQGates();
    this.drawSnakes();

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

  private drawBushes(): void {
    for (const key of this.bushCells) {
      const [col, row] = key.split(',').map(Number);
      const cx = col * CELL_SIZE + CELL_SIZE / 2;
      const cy = row * CELL_SIZE + CELL_SIZE / 2;
      // Bush: layered green circles
      this.bgGraphics.fillStyle(0x1a6b2a, 0.9);
      this.bgGraphics.fillCircle(cx, cy, 10);
      this.bgGraphics.fillStyle(0x2d9440, 0.85);
      this.bgGraphics.fillCircle(cx - 4, cy - 2, 7);
      this.bgGraphics.fillCircle(cx + 4, cy - 2, 7);
      this.bgGraphics.fillCircle(cx, cy - 5, 6);
      // Lighter highlight on top
      this.bgGraphics.fillStyle(0x55cc66, 0.4);
      this.bgGraphics.fillCircle(cx - 2, cy - 5, 4);
      // Dark shadow base
      this.bgGraphics.fillStyle(0x0d3d14, 0.5);
      this.bgGraphics.fillEllipse(cx, cy + 6, 18, 6);
    }
  }

  private drawExitZone(): void {
    if (!this.exitZone) return;
    const cx = this.exitZone.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = this.exitZone.row * CELL_SIZE + CELL_SIZE / 2;
    const pulse = 0.55 + 0.45 * Math.sin(this.exitPulseTimer / 350);
    // Outer glow ring
    this.bgGraphics.fillStyle(0x00ff88, 0.15 * pulse);
    this.bgGraphics.fillCircle(cx, cy, 22);
    // Mid ring
    this.bgGraphics.fillStyle(0x00ff88, 0.35 * pulse);
    this.bgGraphics.fillCircle(cx, cy, 14);
    // Core
    this.bgGraphics.fillStyle(0x00ffaa, 0.85 * pulse);
    this.bgGraphics.fillCircle(cx, cy, 8);
    // Portal swirl dots
    for (let i = 0; i < 6; i++) {
      const angle = (this.exitPulseTimer / 600) + (i / 6) * Math.PI * 2;
      const sx = cx + Math.cos(angle) * 11;
      const sy = cy + Math.sin(angle) * 11;
      this.bgGraphics.fillStyle(0xffffff, 0.7 * pulse);
      this.bgGraphics.fillCircle(sx, sy, 2);
    }
  }

  private drawBackground(): void {
    this.bgGraphics.fillStyle(0x2d5a1b);
    this.bgGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Dirt path strip through middle rows (y=200 to y=280)
    this.bgGraphics.fillStyle(0x8b6914, 0.55);
    this.bgGraphics.fillRect(0, 200, CANVAS_W, 80);
    // Path texture with lighter patches
    this.bgGraphics.fillStyle(0xa07840, 0.25);
    for (let i = 0; i < 20; i++) {
      this.bgGraphics.fillEllipse(i * 34, 228, 28, 14);
      this.bgGraphics.fillEllipse(i * 34 + 17, 252, 22, 10);
    }
    // Grass tufts (deterministic positions, skip path strip)
    this.bgGraphics.fillStyle(0x3d8c28, 0.6);
    for (let i = 0; i < 40; i++) {
      const gx = ((i * 47 + 13) % CANVAS_W);
      const gy = ((i * 31 + 7) % CANVAS_H);
      if (gy > 195 && gy < 285) continue;
      this.bgGraphics.fillEllipse(gx, gy, 8, 4);
    }

    this.bgGraphics.fillStyle(0x6b5744);
    for (const rock of TERRAIN_ROCKS) {
      this.bgGraphics.fillEllipse(rock.x, rock.y, rock.rw, rock.rh);
    }

    this.bgGraphics.fillStyle(0x1c2030, 0.7);
    for (let i = 0; i < CANVAS_W; i += 22) {
      this.bgGraphics.fillCircle(i, CANVAS_H / 2, 1.2);
    }
    for (let i = 0; i < 28; i++) {
      this.bgGraphics.fillCircle(i * 24, i * 18, 1.2);
    }
    for (let i = 0; i < 20; i++) {
      this.bgGraphics.fillCircle(CANVAS_W - i * 32, i * 24, 1.2);
    }

    // Draw walls — use brown plank style if level has an exit zone (bridge level)
    const isBridgeLevel = !!this.exitZone;
    if (isBridgeLevel) {
      // Wood planks (warm updated)
      this.bgGraphics.fillStyle(0x8b6520);
      for (const key of this.walls) {
        const [col, row] = key.split(',').map(Number);
        this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
      // Plank grain lines
      this.bgGraphics.lineStyle(1, 0x5a3210, 0.7);
      for (const key of this.walls) {
        const [col, row] = key.split(',').map(Number);
        this.bgGraphics.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        // Horizontal grain
        this.bgGraphics.strokeRect(col * CELL_SIZE + 2, row * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE - 4, 0);
      }
      // Lighter top edge highlight
      this.bgGraphics.fillStyle(0xc89040, 0.35);
      for (const key of this.walls) {
        const [col, row] = key.split(',').map(Number);
        this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, 3);
      }
    } else {
      // Rocky mountain stone
      this.bgGraphics.fillStyle(0x7a6850);
      for (const key of this.walls) {
        const [col, row] = key.split(',').map(Number);
        this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
      // Top highlight strip
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
    const tongueOut = (this.tongueTimer % 700) < 260;

    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const stunned = snake.stunnedMs > 0;
      const alpha   = stunned ? 0.4 : 1.0;
      const segs    = snake.segments;
      const n       = segs.length;
      const maxBodyR = snake.isBoss ? 10 : 7;
      const headR    = snake.isBoss ? 14 : 9;

      // Head direction vector (from neck to head)
      let dx = 0, dy = 0;
      if (n > 1) {
        dx = segs[0].x - segs[1].x;
        dy = segs[0].y - segs[1].y;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= mag; dy /= mag;
      }
      // Perpendicular (for eye placement)
      const px2 = -dy, py2 = dx;

      // ── Body (tail → neck, drawn back-to-front) ──────────────
      for (let i = n - 1; i >= 1; i--) {
        const seg = segs[i];
        const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;

        // Taper: thinner toward tail (i=n-1 is tip)
        const t = 1 - (i / (n - 1)) * 0.6;   // 1.0 at neck, 0.4 at tail
        const r = maxBodyR * t;

        // Connect to next segment with a filled quad to avoid gaps
        if (i < n - 1) {
          const next = segs[i + 1];
          const nx = next.x * CELL_SIZE + CELL_SIZE / 2;
          const ny = next.y * CELL_SIZE + CELL_SIZE / 2;
          const tNext = 1 - ((i + 1) / (n - 1)) * 0.6;
          const rNext = maxBodyR * tNext;
          const midR = (r + rNext) / 2;
          this.bgGraphics.fillStyle(snake.color, alpha * 0.85);
          this.bgGraphics.fillCircle((cx + nx) / 2, (cy + ny) / 2, midR);
        }

        // Scale stripe: alternate darker/lighter rings
        const scaleAlpha = i % 2 === 0 ? alpha * 0.95 : alpha * 0.70;
        this.bgGraphics.fillStyle(snake.color, scaleAlpha);
        this.bgGraphics.fillCircle(cx, cy, r);

        // Belly highlight (lighter ellipse on underside)
        const bellyColor = this.shiftColor(snake.color, 1.35);
        this.bgGraphics.fillStyle(bellyColor, alpha * 0.35);
        this.bgGraphics.fillEllipse(cx, cy, r * 1.1, r * 0.55);

        // Dark dorsal stripe dot
        const dorsalColor = this.shiftColor(snake.color, 0.55);
        this.bgGraphics.fillStyle(dorsalColor, alpha * 0.55);
        this.bgGraphics.fillCircle(cx, cy, r * 0.38);
      }

      // ── Head ────────────────────────────────────────────────
      const hx = segs[0].x * CELL_SIZE + CELL_SIZE / 2;
      const hy = segs[0].y * CELL_SIZE + CELL_SIZE / 2;

      // Boss crown glow
      if (snake.isBoss) {
        this.bgGraphics.fillStyle(0xffaa00, alpha * 0.45);
        this.bgGraphics.fillCircle(hx, hy, headR + 6);
      }

      // Head base
      this.bgGraphics.fillStyle(snake.color, alpha);
      this.bgGraphics.fillCircle(hx, hy, headR);

      // Head elongation toward mouth
      this.bgGraphics.fillStyle(snake.color, alpha);
      this.bgGraphics.fillEllipse(
        hx + dx * headR * 0.45,
        hy + dy * headR * 0.45,
        headR * 1.6 + Math.abs(dx) * headR * 0.4,
        headR * 1.6 + Math.abs(dy) * headR * 0.4
      );

      // Belly highlight on head
      const headBelly = this.shiftColor(snake.color, 1.4);
      this.bgGraphics.fillStyle(headBelly, alpha * 0.45);
      this.bgGraphics.fillEllipse(hx, hy, headR * 1.1, headR * 0.6);

      // Dark dorsal head stripe
      const headDorsal = this.shiftColor(snake.color, 0.5);
      this.bgGraphics.fillStyle(headDorsal, alpha * 0.5);
      this.bgGraphics.fillCircle(hx - dx * 2, hy - dy * 2, headR * 0.4);

      // Eyes — on sides of head, forward-facing
      const eyeDist = headR * 0.52;
      const eyeFwd  = headR * 0.28;
      for (const side of [1, -1]) {
        const ex = hx + px2 * side * eyeDist + dx * eyeFwd;
        const ey = hy + py2 * side * eyeDist + dy * eyeFwd;
        // Sclera
        this.bgGraphics.fillStyle(0xffffcc, alpha);
        this.bgGraphics.fillCircle(ex, ey, 2.6);
        // Pupil (slit — approximate with dark circle offset toward mouth)
        this.bgGraphics.fillStyle(0x0a0a0a, alpha);
        this.bgGraphics.fillCircle(ex + dx * 0.6, ey + dy * 0.6, 1.5);
        // Eye shine
        this.bgGraphics.fillStyle(0xffffff, alpha * 0.9);
        this.bgGraphics.fillCircle(ex + dx * 0.2 - px2 * side * 0.5, ey + dy * 0.2 - py2 * side * 0.5, 0.6);
      }

      // Tongue (forked, flickers)
      if (tongueOut && !stunned) {
        const tBase  = headR + 2;
        const tLen   = 7;
        const fLen   = 4;
        const t0x = hx + dx * tBase;
        const t0y = hy + dy * tBase;
        const t1x = t0x + dx * tLen;
        const t1y = t0y + dy * tLen;
        this.bgGraphics.fillStyle(0xff2255, alpha);
        // Shaft (thin rectangle along direction)
        this.bgGraphics.fillRect(t0x - px2 * 0.8, t0y - py2 * 0.8, dx * tLen + px2 * 1.6, dy * tLen + py2 * 1.6);
        // Left fork
        this.bgGraphics.fillRect(t1x - px2 * 0.7, t1y - py2 * 0.7,
          (dx - py2) * fLen + px2 * 1.4, (dy + px2) * fLen + py2 * 1.4);
        // Right fork
        this.bgGraphics.fillRect(t1x - px2 * 0.7, t1y - py2 * 0.7,
          (dx + py2) * fLen + px2 * 1.4, (dy - px2) * fLen + py2 * 1.4);
      }

      // Stunned stars
      if (stunned) {
        this.bgGraphics.fillStyle(0xffff44, 0.9);
        this.bgGraphics.fillCircle(hx,           hy - headR - 6, 3.2);
        this.bgGraphics.fillCircle(hx - 7,       hy - headR - 2, 2.2);
        this.bgGraphics.fillCircle(hx + 7,       hy - headR - 2, 2.2);
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

  private drawGlory(): void {
    const { x, y, invincibleMs } = this.glory;

    if (invincibleMs > 0) {
      const flashOn = Math.floor(invincibleMs / 140) % 2 === 0;
      if (!flashOn) return;
    }

    const alpha = this.hiddenInBush ? 0.35 : 1.0;
    const trail = this.gloryTrail.length > 0 ? this.gloryTrail : [{ x, y }];

    // Body color: golden python — distinct from enemy snakes
    const bodyColor  = invincibleMs > 0 ? 0xff6633 : 0xd4a017;
    const bellyColor = invincibleMs > 0 ? 0xffaa66 : 0xf5e08a;
    const scaleColor = invincibleMs > 0 ? 0xcc4400 : 0x8b6800;
    const eyeColor   = 0xff4400;

    // Draw body segments from tail to neck (so head is on top)
    const totalSegs = Math.min(trail.length, this.TRAIL_LENGTH);
    for (let i = totalSegs - 1; i >= 1; i--) {
      const seg = trail[i];
      const t = i / this.TRAIL_LENGTH;
      const radius = 10 * (1 - t * 0.5);

      this.topGraphics.fillStyle(bodyColor, alpha * (1 - t * 0.3));
      this.topGraphics.fillCircle(seg.x, seg.y, radius);

      if (i % 2 === 0) {
        this.topGraphics.fillStyle(scaleColor, alpha * 0.4 * (1 - t * 0.3));
        this.topGraphics.fillCircle(seg.x, seg.y, radius * 0.6);
      }

      this.topGraphics.fillStyle(bellyColor, alpha * 0.3 * (1 - t * 0.5));
      this.topGraphics.fillCircle(seg.x - 1, seg.y - 1, radius * 0.45);
    }

    // Gap-fill between trail points
    for (let i = 0; i < totalSegs - 1; i++) {
      const a = trail[i];
      const b = trail[i + 1];
      const t = i / this.TRAIL_LENGTH;
      const r = 9 * (1 - t * 0.5);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.topGraphics.fillStyle(bodyColor, alpha * (1 - t * 0.3) * 0.7);
      this.topGraphics.fillCircle(mx, my, r);
    }

    // HEAD
    const headRadius = 11;
    let headDx = 0;
    let headDy = -1;
    if (this.dragDir) {
      headDx = this.dragDir.dx;
      headDy = this.dragDir.dy;
    } else if (trail.length >= 2) {
      const dx = trail[0].x - trail[1].x;
      const dy = trail[0].y - trail[1].y;
      const len = Math.hypot(dx, dy);
      if (len > 0.5) { headDx = dx / len; headDy = dy / len; }
    }

    this.topGraphics.fillStyle(bodyColor, alpha);
    this.topGraphics.fillCircle(x, y, headRadius);

    this.topGraphics.fillStyle(scaleColor, alpha * 0.5);
    this.topGraphics.fillCircle(x, y, headRadius * 0.65);

    const snoutX = x + headDx * 7;
    const snoutY = y + headDy * 7;
    this.topGraphics.fillStyle(bodyColor, alpha);
    this.topGraphics.fillEllipse(snoutX, snoutY, 10, 8);

    const perpX = -headDy;
    const perpY =  headDx;
    const eyeOffFwd = 3;
    const eyeOffSide = 5;
    const eyeLX = x + headDx * eyeOffFwd + perpX * eyeOffSide;
    const eyeLY = y + headDy * eyeOffFwd + perpY * eyeOffSide;
    const eyeRX = x + headDx * eyeOffFwd - perpX * eyeOffSide;
    const eyeRY = y + headDy * eyeOffFwd - perpY * eyeOffSide;

    this.topGraphics.fillStyle(0xffee88, alpha);
    this.topGraphics.fillCircle(eyeLX, eyeLY, 3.5);
    this.topGraphics.fillCircle(eyeRX, eyeRY, 3.5);

    this.topGraphics.fillStyle(eyeColor, alpha);
    this.topGraphics.fillEllipse(eyeLX, eyeLY, 2.5, 3.5);
    this.topGraphics.fillEllipse(eyeRX, eyeRY, 2.5, 3.5);

    this.topGraphics.fillStyle(0xffffff, alpha * 0.8);
    this.topGraphics.fillCircle(eyeLX - 0.8, eyeLY - 0.8, 1.2);
    this.topGraphics.fillCircle(eyeRX - 0.8, eyeRY - 0.8, 1.2);

    // Tongue (flicker)
    if (Math.floor(this.tongueTimer / 700) % 3 !== 2) {
      const tongueBase = 0.6;
      const tx = x + headDx * (headRadius + 4);
      const ty = y + headDy * (headRadius + 4);
      this.topGraphics.lineStyle(1.5, 0xff8800, alpha * 0.9);
      this.topGraphics.beginPath();
      this.topGraphics.moveTo(x + headDx * headRadius, y + headDy * headRadius);
      this.topGraphics.lineTo(tx, ty);
      this.topGraphics.strokePath();
      this.topGraphics.lineStyle(1, 0xff8800, alpha * 0.8);
      this.topGraphics.beginPath();
      this.topGraphics.moveTo(tx, ty);
      this.topGraphics.lineTo(tx + headDx * 4 * tongueBase + perpX * 3, ty + headDy * 4 * tongueBase + perpY * 3);
      this.topGraphics.strokePath();
      this.topGraphics.beginPath();
      this.topGraphics.moveTo(tx, ty);
      this.topGraphics.lineTo(tx + headDx * 4 * tongueBase - perpX * 3, ty + headDy * 4 * tongueBase - perpY * 3);
      this.topGraphics.strokePath();
    }

    // Speed power-up glow ring
    if (this.activePowerUp?.kind === 'speed') {
      this.topGraphics.lineStyle(3, 0xffff44, 0.7);
      this.topGraphics.strokeCircle(x, y, 18);
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
    this.threeEffects?.triggerEvent('death', this.glory.x, this.glory.y);
    this.showEndOverlay(`💀 Game Over!\nScore: ${this.score}`, false);
  }

  private winGame(): void {
    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];
    this.score = Math.floor((this.survivalMs / 1000) * config.scoreMultiplier);
    this.updateDOM();
    this.threeEffects?.triggerEvent('win', CANVAS_W / 2, CANVAS_H / 2);
    window.dispatchEvent(new CustomEvent('snake-level-complete', { detail: { mode: gameMode, level: gameLevel } }));
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
    this.threeEffects?.destroy();
    this.threeEffects = null;
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

export function createGame(opts: { bodyColor?: number; headColor?: number; mode: GameMode; level: number }): GameController {
  void opts.bodyColor;
  void opts.headColor;
  gameMode  = opts.mode;
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
