import Phaser from 'phaser';

export interface GameController {
  destroy(): void;
}

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;
const FOOD_COUNT = 3;

type Direction = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN';
interface Point { x: number; y: number; }

const OPPOSITE: Record<Direction, Direction> = {
  RIGHT: 'LEFT', LEFT: 'RIGHT', UP: 'DOWN', DOWN: 'UP'
};
const DELTA: Record<Direction, Point> = {
  RIGHT: { x: 1, y: 0 }, LEFT: { x: -1, y: 0 },
  UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }
};

interface PlayerConfig {
  id: number;
  name: string;
  bodyColor: number;
  headColor: number;
  startX: number;
  startY: number;
  startDir: Direction;
  scoreElId: string;
}

const PLAYERS: PlayerConfig[] = [
  { id: 0, name: 'Player 1', bodyColor: 0xe74c3c, headColor: 0xff6b6b, startX: 6,  startY: 6,  startDir: 'RIGHT', scoreElId: 'p1-score' },
  { id: 1, name: 'Player 2', bodyColor: 0x3498db, headColor: 0x74b9ff, startX: 25, startY: 6,  startDir: 'LEFT',  scoreElId: 'p2-score' },
  { id: 2, name: 'Player 3', bodyColor: 0xf1c40f, headColor: 0xffeaa7, startX: 6,  startY: 17, startDir: 'RIGHT', scoreElId: 'p3-score' },
  { id: 3, name: 'Player 4', bodyColor: 0x9b59b6, headColor: 0xc39bd3, startX: 25, startY: 17, startDir: 'LEFT',  scoreElId: 'p4-score' },
];

interface Snake {
  config: PlayerConfig;
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
}

class SnakeScene extends Phaser.Scene {
  private snakes: Snake[] = [];
  private foods: Point[] = [];
  private tickMs = 150;
  private elapsed = 0;
  private roundOver = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private overlayText!: Phaser.GameObjects.Text;

  // P1 - Arrow keys
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  // P2 - WASD
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  // P3 - IJKL
  private keyI!: Phaser.Input.Keyboard.Key;
  private keyJ!: Phaser.Input.Keyboard.Key;
  private keyK!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  // P4 - TFGH
  private keyT!: Phaser.Input.Keyboard.Key;
  private keyF!: Phaser.Input.Keyboard.Key;
  private keyG!: Phaser.Input.Keyboard.Key;
  private keyH!: Phaser.Input.Keyboard.Key;
  // Space
  private spaceKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SnakeScene' });
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.overlayText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '32px',
      color: '#ffffff',
      align: 'center',
      fontFamily: 'system-ui, sans-serif',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyI = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.keyJ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.keyL = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.keyT = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.keyG = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this.keyH = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.resetGame();
  }

  private resetGame(): void {
    this.snakes = PLAYERS.map((cfg) => {
      const dx = cfg.startDir === 'RIGHT' ? -1 : 1;
      return {
        config: cfg,
        body: [
          { x: cfg.startX, y: cfg.startY },
          { x: cfg.startX + dx, y: cfg.startY },
          { x: cfg.startX + 2 * dx, y: cfg.startY },
        ],
        direction: cfg.startDir,
        nextDirection: cfg.startDir,
        alive: true,
        score: 0,
      };
    });
    this.foods = [];
    this.tickMs = 150;
    this.elapsed = 0;
    this.roundOver = false;
    this.overlayText.setText('');
    this.overlayGraphics.clear();
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }
    this.updateScoreDisplays();
  }

  private allBodyCells(): Set<string> {
    const cells = new Set<string>();
    for (const snake of this.snakes) {
      if (snake.alive) {
        for (const p of snake.body) {
          cells.add(`${p.x},${p.y}`);
        }
      }
    }
    return cells;
  }

  private spawnFood(): void {
    const occupied = this.allBodyCells();
    for (const f of this.foods) {
      occupied.add(`${f.x},${f.y}`);
    }
    let fx = 0;
    let fy = 0;
    let attempts = 0;
    do {
      fx = Phaser.Math.Between(0, COLS - 1);
      fy = Phaser.Math.Between(0, ROWS - 1);
      attempts++;
    } while (occupied.has(`${fx},${fy}`) && attempts < 1000);
    this.foods.push({ x: fx, y: fy });
  }

  private queueDirection(snake: Snake, dir: Direction): void {
    if (dir !== OPPOSITE[snake.direction]) {
      snake.nextDirection = dir;
    }
  }

  private tick(): void {
    const alive = this.snakes.filter((s) => s.alive);

    // Step 1: Commit directions
    for (const snake of alive) {
      snake.direction = snake.nextDirection;
    }

    // Step 2: Compute new heads
    const newHeads = new Map<number, Point>();
    for (const snake of alive) {
      const head = snake.body[0];
      const d = DELTA[snake.direction];
      newHeads.set(snake.config.id, { x: head.x + d.x, y: head.y + d.y });
    }

    // Step 3: Wall collision
    for (const snake of alive) {
      const nh = newHeads.get(snake.config.id)!;
      if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) {
        snake.alive = false;
      }
    }

    const stillAlive = alive.filter((s) => s.alive);

    // Step 4: Determine which snakes eat food
    const foodSet = new Set<string>(this.foods.map((f) => `${f.x},${f.y}`));
    const eatingSnakes = new Set<number>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.config.id)!;
      if (foodSet.has(`${nh.x},${nh.y}`)) {
        eatingSnakes.add(snake.config.id);
      }
    }

    // Step 5: Remove tails for non-eating snakes
    for (const snake of stillAlive) {
      if (!eatingSnakes.has(snake.config.id)) {
        snake.body.pop();
      }
    }

    // Step 6: Build occupied cell set (bodies after tail removal)
    const occupied = new Set<string>();
    for (const snake of stillAlive) {
      for (const p of snake.body) {
        occupied.add(`${p.x},${p.y}`);
      }
    }

    // Step 7: Detect body collisions and head-head collisions
    const headCellToSnakes = new Map<string, Snake[]>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.config.id)!;
      const key = `${nh.x},${nh.y}`;
      if (!headCellToSnakes.has(key)) headCellToSnakes.set(key, []);
      headCellToSnakes.get(key)!.push(snake);
    }

    const toKill = new Set<number>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.config.id)!;
      if (occupied.has(`${nh.x},${nh.y}`)) {
        toKill.add(snake.config.id);
      }
    }
    for (const [, snakesAtCell] of headCellToSnakes) {
      if (snakesAtCell.length > 1) {
        for (const s of snakesAtCell) toKill.add(s.config.id);
      }
    }
    for (const id of toKill) {
      this.snakes[id].alive = false;
    }

    // Step 8: Prepend new heads for survivors; handle food eating
    const survivors = stillAlive.filter((s) => s.alive);
    for (const snake of survivors) {
      const nh = newHeads.get(snake.config.id)!;
      snake.body.unshift(nh);
      if (eatingSnakes.has(snake.config.id)) {
        snake.score += 10;
        const foodKey = `${nh.x},${nh.y}`;
        this.foods = this.foods.filter((f) => `${f.x},${f.y}` !== foodKey);
        this.spawnFood();
        this.tickMs = Math.max(80, this.tickMs - 3);
      }
    }

    this.updateScoreDisplays();
    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    const alive = this.snakes.filter((s) => s.alive);
    if (alive.length <= 1) {
      this.endRound(alive.length === 1 ? alive[0] : null);
    }
  }

  private endRound(winner: Snake | null): void {
    this.roundOver = true;
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const msg = winner
      ? `${winner.config.name} Wins! 🏆\n\nPress SPACE to play again`
      : 'Draw! 🤝\n\nPress SPACE to play again';
    this.overlayText.setText(msg);
  }

  private updateScoreDisplays(): void {
    for (const snake of this.snakes) {
      const el = document.getElementById(snake.config.scoreElId);
      if (el) el.textContent = String(snake.score);
    }
  }

  update(_time: number, delta: number): void {
    if (!this.roundOver) {
      const p1 = this.snakes[0];
      if (p1.alive) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.queueDirection(p1, 'RIGHT');
        else if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.queueDirection(p1, 'LEFT');
        else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.queueDirection(p1, 'UP');
        else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.queueDirection(p1, 'DOWN');
      }
      const p2 = this.snakes[1];
      if (p2.alive) {
        if (Phaser.Input.Keyboard.JustDown(this.keyD)) this.queueDirection(p2, 'RIGHT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyA)) this.queueDirection(p2, 'LEFT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyW)) this.queueDirection(p2, 'UP');
        else if (Phaser.Input.Keyboard.JustDown(this.keyS)) this.queueDirection(p2, 'DOWN');
      }
      const p3 = this.snakes[2];
      if (p3.alive) {
        if (Phaser.Input.Keyboard.JustDown(this.keyL)) this.queueDirection(p3, 'RIGHT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyJ)) this.queueDirection(p3, 'LEFT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyI)) this.queueDirection(p3, 'UP');
        else if (Phaser.Input.Keyboard.JustDown(this.keyK)) this.queueDirection(p3, 'DOWN');
      }
      const p4 = this.snakes[3];
      if (p4.alive) {
        if (Phaser.Input.Keyboard.JustDown(this.keyH)) this.queueDirection(p4, 'RIGHT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyF)) this.queueDirection(p4, 'LEFT');
        else if (Phaser.Input.Keyboard.JustDown(this.keyT)) this.queueDirection(p4, 'UP');
        else if (Phaser.Input.Keyboard.JustDown(this.keyG)) this.queueDirection(p4, 'DOWN');
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.resetGame();
      }
    }

    if (!this.roundOver) {
      this.elapsed += delta;
      while (this.elapsed >= this.tickMs) {
        this.elapsed -= this.tickMs;
        this.tick();
        if (this.roundOver) break;
      }
    }

    this.draw();
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    // Background
    g.fillStyle(0x0d1a0d);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    g.lineStyle(1, 0x1a2e1a, 1);
    for (let col = 0; col <= COLS; col++) {
      g.beginPath();
      g.moveTo(col * CELL_SIZE, 0);
      g.lineTo(col * CELL_SIZE, CANVAS_H);
      g.strokePath();
    }
    for (let row = 0; row <= ROWS; row++) {
      g.beginPath();
      g.moveTo(0, row * CELL_SIZE);
      g.lineTo(CANVAS_W, row * CELL_SIZE);
      g.strokePath();
    }

    // Food
    g.fillStyle(0xff4500);
    for (const food of this.foods) {
      g.fillCircle(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2
      );
    }

    // Draw alive snakes
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      g.fillStyle(snake.config.bodyColor);
      for (let i = 1; i < snake.body.length; i++) {
        const seg = snake.body[i];
        g.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
      if (snake.body.length > 0) {
        g.fillStyle(snake.config.headColor);
        const h = snake.body[0];
        g.fillRect(h.x * CELL_SIZE + 1, h.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }
  }
}

export function createGame(): GameController {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: CANVAS_W,
    height: CANVAS_H,
    parent: 'game-root',
    backgroundColor: '#0d1a0d',
    scene: SnakeScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });

  return {
    destroy(): void {
      game.destroy(true);
    }
  };
}
