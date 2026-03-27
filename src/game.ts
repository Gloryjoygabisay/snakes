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
  bannerText?: string;   // shown as popup text when level starts (e.g. Level 3)
  windEffect?: boolean;  // Level 9: wind pushes snake slightly
}

const LEVEL_CONFIGS: LevelConfig[] = [
  // Level 1: Mountain Path — wide, straight, no enemies
  {
    name: 'Mountain Path',
    survivalGoal: 999, snakeCount: 0, snakeTickMs: 600, glorySpeed: 1.5, lives: 3, scoreMultiplier: 1, fogOfWar: false,
    walls: [
      ...hwall(8,  2, 29), ...hwall(16, 2, 29),
    ],
    poisonTiles: [], iqGatePositions: [], movingWallConfigs: [], hasBoss: false, speedRamp: false,
    gloryStart: { col: 2, row: 12 },
    exitZone:   { col: 30, row: 12 },
    collectibles: [[5,12],[8,10],[11,12],[14,10],[17,12],[20,10],[23,12],[26,10]] as [number,number][],
    bushes: [[4,11],[10,13],[18,11],[24,13]],
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
      // Pillars / limited safe zones
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
];

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
      // Base speed is capped at 1.2 px/frame for smooth, controllable movement
      const baseSpd = Math.min(this.glory.speed, 1.2);
      const spd = this.activePowerUp?.kind === 'speed'
        ? baseSpd * 1.8
        : baseSpd;

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
    this.gloryTrail.unshift({ x: this.glory.x, y: this.glory.y });
    if (this.gloryTrail.length > this.gloryTrailMax) this.gloryTrail.pop();

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
        this.gloryTrailMax = Math.min(24, this.gloryTrailMax + 3); // grow snake!
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

  private drawBackground(): void {
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
    const totalSegs = Math.min(trail.length, this.gloryTrailMax);
    for (let i = totalSegs - 1; i >= 1; i--) {
      const seg = trail[i];
      const t = i / this.gloryTrailMax;
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
      const t = i / this.gloryTrailMax;
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
