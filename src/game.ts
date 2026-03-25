import Phaser from 'phaser';

export interface GameController {
  destroy(): void;
}

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE; // 640
const CANVAS_H = ROWS * CELL_SIZE; // 480

type Direction = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN';

interface Point {
  x: number;
  y: number;
}

class SnakeScene extends Phaser.Scene {
  private snake: Point[] = [];
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private food: Point = { x: 0, y: 0 };
  private score = 0;
  private highScore = 0;
  private tickMs = 150;
  private elapsed = 0;
  private gameOver = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private overlayText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private touchListeners: Array<{ el: Element; fn: EventListener }> = [];

  constructor() {
    super({ key: 'SnakeScene' });
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.overlayText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '28px',
      color: '#4ecca3',
      align: 'center',
      fontFamily: 'system-ui, sans-serif'
    }).setOrigin(0.5).setDepth(10);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.setupTouchControls();
    this.resetGame();
  }

  private setupTouchControls(): void {
    const directions: Array<{ selector: string; dir: Direction }> = [
      { selector: '.touch-up', dir: 'UP' },
      { selector: '.touch-down', dir: 'DOWN' },
      { selector: '.touch-left', dir: 'LEFT' },
      { selector: '.touch-right', dir: 'RIGHT' }
    ];

    for (const { selector, dir } of directions) {
      const el = document.querySelector(selector);
      if (el) {
        const fn: EventListener = () => {
          if (this.gameOver) {
            this.resetGame();
          } else {
            this.queueDirection(dir);
          }
        };
        el.addEventListener('click', fn);
        this.touchListeners.push({ el, fn });
      }
    }
  }

  private resetGame(): void {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.score = 0;
    this.tickMs = 150;
    this.elapsed = 0;
    this.gameOver = false;
    this.overlayText.setText('');
    this.overlayGraphics.clear();
    this.updateScoreDisplay();
    this.spawnFood();
  }

  private spawnFood(): void {
    const occupied = new Set(this.snake.map((p) => `${p.x},${p.y}`));
    let fx: number;
    let fy: number;
    do {
      fx = Phaser.Math.Between(0, COLS - 1);
      fy = Phaser.Math.Between(0, ROWS - 1);
    } while (occupied.has(`${fx},${fy}`));
    this.food = { x: fx, y: fy };
  }

  private queueDirection(dir: Direction): void {
    const opposite: Record<Direction, Direction> = {
      RIGHT: 'LEFT',
      LEFT: 'RIGHT',
      UP: 'DOWN',
      DOWN: 'UP'
    };
    if (dir !== opposite[this.direction]) {
      this.nextDirection = dir;
    }
  }

  private tick(): void {
    this.direction = this.nextDirection;
    const head = this.snake[0];
    const delta: Record<Direction, Point> = {
      RIGHT: { x: 1, y: 0 },
      LEFT: { x: -1, y: 0 },
      UP: { x: 0, y: -1 },
      DOWN: { x: 0, y: 1 }
    };
    const d = delta[this.direction];
    const newHead: Point = { x: head.x + d.x, y: head.y + d.y };

    // Wall collision
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      this.endGame();
      return;
    }

    // Self collision
    if (this.snake.some((p) => p.x === newHead.x && p.y === newHead.y)) {
      this.endGame();
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 10;
      if (this.score > this.highScore) this.highScore = this.score;
      this.tickMs = Math.max(60, this.tickMs - 2);
      this.updateScoreDisplay();
      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  private endGame(): void {
    this.gameOver = true;
    this.overlayGraphics.fillStyle(0x000000, 0.6);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.overlayText.setText(
      `GAME OVER\nScore: ${this.score}\n\nPress SPACE or tap to restart`
    );
  }

  private updateScoreDisplay(): void {
    const scoreEl = document.getElementById('score-value');
    const highScoreEl = document.getElementById('high-score-value');
    if (scoreEl) scoreEl.textContent = String(this.score);
    if (highScoreEl) highScoreEl.textContent = String(this.highScore);
  }

  update(_time: number, delta: number): void {
    // Input handling
    if (!this.gameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.right)) {
        this.queueDirection('RIGHT');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.left)) {
        this.queueDirection('LEFT');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) {
        this.queueDirection('UP');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) {
        this.queueDirection('DOWN');
      }
    } else {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.resetGame();
      }
    }

    if (!this.gameOver) {
      this.elapsed += delta;
      while (this.elapsed >= this.tickMs) {
        this.elapsed -= this.tickMs;
        this.tick();
        if (this.gameOver) break;
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
    g.fillStyle(0xe74c3c);
    g.fillRect(
      this.food.x * CELL_SIZE + 2,
      this.food.y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4
    );

    // Snake body
    g.fillStyle(0x2a8a6a);
    for (let i = 1; i < this.snake.length; i++) {
      const seg = this.snake[i];
      g.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    // Snake head
    if (this.snake.length > 0) {
      g.fillStyle(0x4ecca3);
      const h = this.snake[0];
      g.fillRect(h.x * CELL_SIZE + 1, h.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  shutdown(): void {
    for (const { el, fn } of this.touchListeners) {
      el.removeEventListener('click', fn);
    }
    this.touchListeners = [];
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
