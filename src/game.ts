import Phaser from 'phaser';

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
}

const LEVEL_CONFIGS: Record<GameMode, LevelConfig[]> = {
  explorer: [
    { name: 'Basic Movement', survivalGoal: 20, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false, walls: [], poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Open Fields', survivalGoal: 30, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false, walls: [], poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Fences', survivalGoal: 45, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [...hwall(8, 6, 11), ...hwall(8, 13, 18), ...hwall(16, 10, 14), ...hwall(16, 17, 22), ...vwall(24, 4, 9), ...vwall(8, 14, 20)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'First Maze', survivalGoal: 60, snakeCount: 0, snakeTickMs: 400, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [...hwall(4, 4, 14), ...hwall(4, 17, 27), ...hwall(12, 4, 10), ...hwall(12, 14, 27), ...hwall(20, 4, 14), ...hwall(20, 17, 27), ...vwall(4, 4, 10), ...vwall(4, 14, 20), ...vwall(28, 4, 10), ...vwall(28, 14, 20), ...vwall(16, 6, 10), ...vwall(16, 14, 18)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Mini Challenge', survivalGoal: 60, snakeCount: 1, snakeTickMs: 480, glorySpeed: 2.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
      walls: [...hwall(6, 6, 14), ...hwall(18, 16, 26), ...vwall(20, 4, 10), ...vwall(12, 14, 20)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
  ],
  survivor: [
    { name: 'Intro Survival', survivalGoal: 60, snakeCount: 1, snakeTickMs: 320, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false, walls: [], poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Narrow Paths', survivalGoal: 60, snakeCount: 1, snakeTickMs: 300, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(5, 2, 14), ...hwall(5, 17, 29), ...hwall(18, 2, 13), ...hwall(18, 16, 29)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Bamboo Bridge', survivalGoal: 75, snakeCount: 1, snakeTickMs: 300, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(8, 0, 11), ...hwall(8, 14, 31), ...hwall(16, 0, 11), ...hwall(16, 14, 31), ...vwall(13, 8, 16)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Split Path', survivalGoal: 75, snakeCount: 1, snakeTickMs: 280, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...vwall(16, 2, 8), ...vwall(16, 14, 21), ...hwall(6, 4, 14), ...hwall(17, 4, 26), ...hwall(18, 4, 14), ...hwall(6, 18, 26)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'First Hunter', survivalGoal: 90, snakeCount: 2, snakeTickMs: 250, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(8, 4, 12), ...hwall(8, 18, 28), ...hwall(16, 4, 12), ...hwall(16, 18, 28), ...vwall(20, 8, 16)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Dark Forest', survivalGoal: 90, snakeCount: 2, snakeTickMs: 260, glorySpeed: 2.8, lives: 2, scoreMultiplier: 2, fogOfWar: true,
      walls: [...vwall(8, 4, 12), ...vwall(24, 10, 20), ...hwall(6, 10, 20), ...hwall(18, 6, 16)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Speed + Obstacles', survivalGoal: 90, snakeCount: 2, snakeTickMs: 200, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(4, 4, 10), ...hwall(4, 16, 27), ...hwall(10, 2, 8), ...hwall(10, 20, 28), ...hwall(14, 6, 12), ...hwall(14, 18, 26), ...hwall(20, 2, 8), ...hwall(20, 22, 28), ...vwall(16, 4, 8), ...vwall(16, 16, 20), ...vwall(22, 10, 14)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Maze Survival', survivalGoal: 120, snakeCount: 2, snakeTickMs: 220, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(4, 2, 10), ...hwall(4, 14, 22), ...hwall(8, 6, 14), ...hwall(8, 16, 28), ...hwall(12, 2, 10), ...hwall(12, 14, 22), ...hwall(16, 6, 14), ...hwall(16, 18, 26), ...hwall(20, 2, 10), ...hwall(20, 14, 22), ...vwall(4, 4, 12), ...vwall(4, 16, 22), ...vwall(12, 4, 8), ...vwall(12, 14, 20), ...vwall(20, 4, 8), ...vwall(20, 16, 20), ...vwall(28, 4, 12), ...vwall(28, 16, 22)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Multiple Enemies', survivalGoal: 120, snakeCount: 4, snakeTickMs: 210, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(4, 2, 10), ...hwall(4, 14, 22), ...hwall(8, 6, 14), ...hwall(8, 16, 28), ...hwall(16, 4, 12), ...hwall(16, 18, 26), ...vwall(4, 4, 12), ...vwall(4, 16, 20), ...vwall(20, 4, 8), ...vwall(20, 16, 20), ...vwall(28, 6, 14)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Boss Stage', survivalGoal: 150, snakeCount: 3, snakeTickMs: 220, glorySpeed: 3.0, lives: 2, scoreMultiplier: 2, fogOfWar: false,
      walls: [...hwall(4, 2, 10), ...hwall(4, 14, 28), ...hwall(20, 2, 10), ...hwall(20, 14, 28), ...vwall(4, 4, 10), ...vwall(4, 14, 20), ...vwall(28, 4, 10), ...vwall(28, 14, 20), ...vwall(16, 6, 10), ...vwall(16, 14, 18)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: true, speedRamp: false },
  ],
  legend: [
    { name: 'Fast Start', survivalGoal: 60, snakeCount: 2, snakeTickMs: 200, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false, walls: [], poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Tight Corridor', survivalGoal: 75, snakeCount: 2, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(6, 2, 13), ...hwall(6, 18, 29), ...hwall(17, 2, 13), ...hwall(17, 18, 29), ...vwall(14, 6, 17)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Double Chase', survivalGoal: 75, snakeCount: 3, snakeTickMs: 180, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...vwall(8, 4, 12), ...vwall(8, 14, 20), ...vwall(24, 4, 12), ...vwall(24, 14, 20), ...hwall(6, 8, 22), ...hwall(18, 8, 22)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'IQ Gate Traps', survivalGoal: 90, snakeCount: 2, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(8, 4, 13), ...hwall(8, 15, 27), ...hwall(16, 4, 11), ...hwall(16, 13, 27), ...vwall(12, 4, 6), ...vwall(12, 10, 14), ...vwall(20, 6, 14)],
      poisonTiles: [],
      iqGatePositions: [{ col: 14, row: 8, challengeIdx: 0 }, { col: 12, row: 16, challengeIdx: 1 }, { col: 21, row: 8, challengeIdx: 2 }],
      movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Maze + Blind', survivalGoal: 90, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [...hwall(4, 2, 10), ...hwall(4, 14, 28), ...hwall(10, 4, 12), ...hwall(10, 16, 26), ...hwall(16, 2, 8), ...hwall(16, 18, 28), ...hwall(20, 4, 14), ...vwall(4, 6, 10), ...vwall(4, 14, 20), ...vwall(14, 4, 10), ...vwall(14, 14, 18), ...vwall(24, 6, 14)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Speed Ramp', survivalGoal: 100, snakeCount: 3, snakeTickMs: 200, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(6, 4, 12), ...hwall(6, 18, 28), ...hwall(18, 4, 10), ...hwall(18, 16, 28), ...vwall(16, 4, 8), ...vwall(16, 14, 20), ...vwall(10, 10, 14)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: true },
    { name: 'Poison Zones', survivalGoal: 100, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(8, 4, 14), ...hwall(8, 18, 28), ...vwall(16, 6, 18)],
      poisonTiles: [[6, 2], [7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [22, 20], [23, 20], [24, 20], [22, 21], [23, 21], [6, 20], [7, 20], [8, 20]],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Multi Traps', survivalGoal: 120, snakeCount: 3, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(4, 4, 13), ...hwall(4, 15, 28), ...hwall(10, 2, 8), ...hwall(10, 20, 28), ...hwall(16, 4, 9), ...hwall(16, 11, 17), ...hwall(16, 19, 26), ...hwall(20, 2, 8), ...hwall(20, 22, 28), ...vwall(8, 6, 10), ...vwall(8, 14, 20), ...vwall(24, 4, 10), ...vwall(24, 14, 22)],
      poisonTiles: [],
      iqGatePositions: [{ col: 14, row: 4, challengeIdx: 3 }, { col: 10, row: 16, challengeIdx: 4 }, { col: 18, row: 16, challengeIdx: 5 }],
      movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Vision + Enemies', survivalGoal: 120, snakeCount: 4, snakeTickMs: 185, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [...hwall(6, 4, 12), ...hwall(6, 18, 28), ...hwall(16, 4, 12), ...hwall(16, 20, 28), ...vwall(4, 6, 14), ...vwall(28, 6, 18), ...vwall(16, 8, 12)],
      poisonTiles: [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [28, 20], [29, 20], [30, 20], [29, 21], [30, 21]],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'Mini Boss', survivalGoal: 150, snakeCount: 4, snakeTickMs: 190, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(4, 4, 14), ...hwall(4, 18, 28), ...hwall(20, 4, 14), ...hwall(20, 18, 28), ...vwall(4, 4, 10), ...vwall(4, 14, 20), ...vwall(28, 4, 10), ...vwall(28, 14, 20), ...vwall(16, 6, 10), ...vwall(16, 14, 18), ...hwall(12, 8, 14), ...hwall(12, 18, 24)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: true, speedRamp: false },
    { name: 'Moving Obstacles', survivalGoal: 150, snakeCount: 3, snakeTickMs: 185, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(8, 2, 10), ...hwall(8, 20, 28), ...hwall(16, 4, 12), ...hwall(16, 18, 26), ...vwall(8, 4, 8), ...vwall(8, 14, 18), ...vwall(24, 6, 12), ...vwall(24, 14, 20)],
      poisonTiles: [], iqGatePositions: [],
      movingWallConfigs: [{ col: 16, row: 12, col2: 16, row2: 14, intervalMs: 5000 }, { col: 8, row: 8, col2: 10, row2: 8, intervalMs: 4000 }, { col: 24, row: 12, col2: 22, row2: 12, intervalMs: 6000 }],
      hasBoss: false, speedRamp: false },
    { name: 'High-Speed Chase', survivalGoal: 120, snakeCount: 4, snakeTickMs: 160, glorySpeed: 3.5, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(6, 4, 14), ...hwall(6, 18, 28), ...hwall(18, 2, 12), ...hwall(18, 16, 28), ...vwall(14, 6, 12), ...vwall(14, 14, 20), ...vwall(22, 4, 10)],
      poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'IQ + Move Combo', survivalGoal: 150, snakeCount: 4, snakeTickMs: 175, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [...hwall(6, 2, 10), ...hwall(6, 18, 28), ...hwall(14, 4, 11), ...hwall(14, 13, 26), ...hwall(20, 2, 8), ...hwall(20, 20, 28), ...vwall(4, 6, 14), ...vwall(28, 8, 18), ...vwall(18, 6, 12)],
      poisonTiles: [],
      iqGatePositions: [{ col: 12, row: 14, challengeIdx: 6 }, { col: 19, row: 8, challengeIdx: 7 }],
      movingWallConfigs: [{ col: 18, row: 12, col2: 18, row2: 14, intervalMs: 5000 }, { col: 4, row: 14, col2: 6, row2: 14, intervalMs: 4500 }],
      hasBoss: false, speedRamp: false },
    { name: 'No Safe Zones', survivalGoal: 180, snakeCount: 5, snakeTickMs: 175, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: false,
      walls: [...hwall(4, 2, 10), ...hwall(4, 14, 22), ...hwall(10, 4, 14), ...hwall(10, 18, 28), ...hwall(16, 2, 8), ...hwall(16, 20, 28), ...hwall(20, 4, 16), ...vwall(4, 4, 8), ...vwall(4, 14, 20), ...vwall(12, 6, 10), ...vwall(12, 14, 20), ...vwall(20, 4, 10), ...vwall(20, 14, 20), ...vwall(28, 4, 12)],
      poisonTiles: [[2, 4], [3, 4], [2, 5], [3, 5], [26, 2], [27, 2], [28, 2], [27, 3], [14, 10], [15, 10], [14, 11], [15, 11], [2, 18], [3, 18], [2, 19], [3, 19], [26, 20], [27, 20], [28, 20], [27, 21]],
      iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false },
    { name: 'FINAL VENOM ARENA', survivalGoal: 240, snakeCount: 7, snakeTickMs: 165, glorySpeed: 3.2, lives: 1, scoreMultiplier: 3, fogOfWar: true,
      walls: [...hwall(4, 2, 10), ...hwall(4, 16, 28), ...hwall(8, 4, 14), ...hwall(8, 18, 28), ...hwall(14, 2, 8), ...hwall(14, 20, 28), ...hwall(20, 4, 14), ...hwall(20, 18, 26), ...vwall(4, 4, 8), ...vwall(4, 14, 20), ...vwall(12, 6, 12), ...vwall(12, 14, 20), ...vwall(20, 4, 8), ...vwall(20, 16, 20), ...vwall(28, 6, 14), ...vwall(16, 8, 12)],
      poisonTiles: [[2, 2], [3, 2], [2, 3], [3, 3], [28, 2], [29, 2], [30, 2], [29, 3], [2, 20], [3, 20], [2, 21], [3, 21], [28, 20], [29, 20], [30, 20], [29, 21], [14, 12], [15, 12], [16, 12], [14, 13], [15, 13], [8, 8], [9, 8], [8, 9], [9, 9]],
      iqGatePositions: [{ col: 11, row: 4, challengeIdx: 9 }, { col: 15, row: 4, challengeIdx: 0 }, { col: 21, row: 4, challengeIdx: 1 }],
      movingWallConfigs: [{ col: 16, row: 8, col2: 16, row2: 10, intervalMs: 4000 }, { col: 4, row: 8, col2: 6, row2: 8, intervalMs: 5000 }, { col: 28, row: 14, col2: 26, row2: 14, intervalMs: 4500 }, { col: 12, row: 12, col2: 12, row2: 14, intervalMs: 6000 }],
      hasBoss: true, speedRamp: true },
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

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private topGraphics!: Phaser.GameObjects.Graphics;

  private overlayText!: Phaser.GameObjects.Text;

  private pointerDown = false;
  private dragDir: { dx: number; dy: number } | null = null;

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
    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];

    this.glory = {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      speed: config.glorySpeed,
      lives: config.lives,
      invincibleMs: 0,
    };

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
    this.pointerDown = false;

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
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.waitingForTrapPlacement) {
        this.placeTrap(ptr.x, ptr.y);
        return;
      }
      this.pointerDown = true;
      this.updateDragDir(ptr.x, ptr.y);
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.pointerDown) this.updateDragDir(ptr.x, ptr.y);
    });
    this.input.on('pointerup', () => { this.pointerDown = false; });
  }

  private updateDragDir(px: number, py: number): void {
    const dx = px - this.glory.x;
    const dy = py - this.glory.y;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      this.dragDir = { dx: dx / len, dy: dy / len };
    }
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
    const dx = gc.x - head.x;
    const dy = gc.y - head.y;

    let nx = head.x;
    let ny = head.y;

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
    if (this.pointerDown && this.dragDir) {
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

    // Check win
    const goal = config.survivalGoal;
    if (this.survivalMs >= goal * 1000) {
      this.winGame();
      return;
    }

    this.score = Math.floor((this.survivalMs / 1000) * config.scoreMultiplier);

    this.updateDOM();
    this.drawScene();
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

  private drawBackground(): void {
    this.bgGraphics.fillStyle(0x060810);
    this.bgGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.bgGraphics.fillStyle(0x14181e);
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

    // Draw walls
    this.bgGraphics.fillStyle(0x334455);
    for (const key of this.walls) {
      const [col, row] = key.split(',').map(Number);
      this.bgGraphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    this.bgGraphics.lineStyle(1, 0x4466aa, 0.5);
    for (const key of this.walls) {
      const [col, row] = key.split(',').map(Number);
      this.bgGraphics.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  private drawPoisonTiles(): void {
    this.bgGraphics.fillStyle(0x550022, 0.7);
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
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const stunned = snake.stunnedMs > 0;
      const alpha = stunned ? 0.45 : 1.0;
      const bodyAlpha = stunned ? 0.3 : 0.75;
      const headRadius = snake.isBoss ? 14 : 9;
      const bodyRadius = snake.isBoss ? 10 : 7;

      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const px = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const py = seg.y * CELL_SIZE + CELL_SIZE / 2;

        if (i === 0) {
          // Head
          if (snake.isBoss) {
            // Boss: gold outline
            this.bgGraphics.fillStyle(0xffaa00, alpha);
            this.bgGraphics.fillCircle(px, py, headRadius + 3);
          }
          this.bgGraphics.fillStyle(snake.color, alpha);
          this.bgGraphics.fillCircle(px, py, headRadius);
          // Eyes
          this.bgGraphics.fillStyle(0xffffff, alpha);
          this.bgGraphics.fillCircle(px - 3, py - 2, 2);
          this.bgGraphics.fillCircle(px + 3, py - 2, 2);
          this.bgGraphics.fillStyle(0x111111, alpha);
          this.bgGraphics.fillCircle(px - 2.5, py - 2, 1.2);
          this.bgGraphics.fillCircle(px + 3.5, py - 2, 1.2);
          if (stunned) {
            this.bgGraphics.fillStyle(0xffff00, 0.8);
            this.bgGraphics.fillCircle(px, py - 14, 3);
            this.bgGraphics.fillCircle(px - 8, py - 10, 2);
            this.bgGraphics.fillCircle(px + 8, py - 10, 2);
          }
        } else {
          this.bgGraphics.fillStyle(snake.color, i % 2 === 0 ? alpha : bodyAlpha);
          this.bgGraphics.fillCircle(px, py, bodyRadius);
        }
      }
    }
  }

  private drawGlory(): void {
    const { x, y, invincibleMs } = this.glory;

    if (invincibleMs > 0) {
      const flashOn = Math.floor(invincibleMs / 140) % 2 === 0;
      if (!flashOn) return;
    }

    const bodyColor = invincibleMs > 0 ? 0xff3333 : 0x6aaa6a;
    const rimColor  = invincibleMs > 0 ? 0xff8888 : 0xaaffaa;

    this.topGraphics.fillStyle(bodyColor);
    this.topGraphics.fillCircle(x, y, 12);

    if (this.dragDir) {
      const fx = x + this.dragDir.dx * 8;
      const fy = y + this.dragDir.dy * 8;
      this.topGraphics.fillStyle(0xffffff, 0.9);
      this.topGraphics.fillCircle(fx, fy, 3.5);
    }

    this.topGraphics.lineStyle(2, rimColor, 0.9);
    this.topGraphics.strokeCircle(x, y, 12);

    if (this.activePowerUp?.kind === 'speed') {
      this.topGraphics.lineStyle(3, 0xffff44, 0.7);
      this.topGraphics.strokeCircle(x, y, 16);
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
  private showEndOverlay(msg: string): void {
    this.roundOver = true;
    this.snakeTickTimer?.remove();
    this.dismissSusieOffer();

    this.overlayGraphics.clear();
    this.overlayGraphics.fillStyle(0x000000, 0.72);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.overlayText.setText(msg);

    document.getElementById('retry-btn')?.classList.remove('hidden');
  }

  private gameOver(): void {
    this.showEndOverlay(`💀 Game Over!\nScore: ${this.score}`);
  }

  private winGame(): void {
    const config = LEVEL_CONFIGS[gameMode][gameLevel - 1];
    this.score = Math.floor((this.survivalMs / 1000) * config.scoreMultiplier);
    this.updateDOM();
    window.dispatchEvent(new CustomEvent('snake-level-complete', { detail: { mode: gameMode, level: gameLevel } }));
    this.showEndOverlay(`🏆 You Survived!\nScore: ${this.score}`);
  }

  private resetGame(): void {
    document.getElementById('retry-btn')?.classList.add('hidden');
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
