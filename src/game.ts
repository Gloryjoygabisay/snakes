import Phaser from 'phaser';

export interface GameController { destroy(): void; }

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;
const FOOD_COUNT = 3;
const BASE_TICK_MS = 150;
const SPEED_BOOST_TICK_MS = 80;

type Direction = 'RIGHT' | 'LEFT' | 'UP' | 'DOWN';
interface Point { x: number; y: number; }

const OPPOSITE: Record<Direction, Direction> = { RIGHT: 'LEFT', LEFT: 'RIGHT', UP: 'DOWN', DOWN: 'UP' };
const DELTA: Record<Direction, Point> = {
  RIGHT: { x: 1, y: 0 }, LEFT: { x: -1, y: 0 }, UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }
};

const LEFT_OF: Record<Direction, Direction> = { RIGHT: 'UP', UP: 'LEFT', LEFT: 'DOWN', DOWN: 'RIGHT' };
const RIGHT_OF: Record<Direction, Direction> = { RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP', UP: 'RIGHT' };

type PowerUpKind = 'speed' | 'shield' | 'none';
interface ActivePowerUp { kind: PowerUpKind; msRemaining: number; }

type FoodKind = 'apple' | 'speed' | 'shield' | 'skull' | 'star';
interface Food { x: number; y: number; kind: FoodKind; }

interface SnakeState {
  id: number;
  name: string;
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
  bodyColor: number;
  headColor: number;
  isHuman: boolean;
  powerUp: ActivePowerUp;
  stunnedMs: number;
  scoreElId: string;
}

interface Challenge {
  question: string;
  choices: string[];
  correct: number;
}

const CHALLENGES: Challenge[] = [
  { question: 'What is 8 × 9?', choices: ['63', '72', '81', '64'], correct: 1 },
  { question: 'Is 37 a prime number?', choices: ['Yes', 'No'], correct: 0 },
  { question: 'Which has more sides: a hexagon or a pentagon?', choices: ['Hexagon', 'Pentagon', 'Same'], correct: 0 },
  { question: 'What comes next: 2, 4, 8, 16, ___?', choices: ['24', '32', '30', '28'], correct: 1 },
  { question: 'TRUE or FALSE: A square is always a rectangle.', choices: ['TRUE', 'FALSE'], correct: 0 },
  { question: 'How many minutes in 2.5 hours?', choices: ['120', '135', '150', '160'], correct: 2 },
  { question: 'What is the square root of 144?', choices: ['11', '12', '13', '14'], correct: 1 },
  { question: 'TRUE or FALSE: All rectangles are squares.', choices: ['TRUE', 'FALSE'], correct: 1 },
  { question: 'If a snake grows 1 cell per food, how long after eating 7 foods starting at length 3?', choices: ['7', '9', '10', '12'], correct: 2 },
  { question: 'What is 15% of 200?', choices: ['25', '30', '35', '40'], correct: 1 },
];

function pickFoodKind(): FoodKind {
  const r = Math.random() * 100;
  if (r < 50) return 'apple';
  if (r < 70) return 'speed';
  if (r < 85) return 'shield';
  if (r < 95) return 'skull';
  return 'star';
}

class SnakeScene extends Phaser.Scene {
  private snakes: SnakeState[] = [];
  private foods: Food[] = [];
  private globalTickMs = BASE_TICK_MS;
  private elapsed = 0;
  private roundOver = false;
  private challengeActive = false;
  private activeChallenge: Challenge | null = null;
  private challengeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private overlayText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private domListeners: Array<{ el: Element; event: string; fn: EventListener }> = [];
  private tonguePhase = 0; // ms counter for tongue animation (cycle: 700ms)

  constructor() {
    super({ key: 'SnakeScene' });
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.overlayText = this.add.text(CANVAS_W / 2, CANVAS_H / 2, '', {
      fontSize: '28px',
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
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.resetGame();
  }

  private resetGame(): void {
    // Clear old DOM listeners from previous round
    for (const { el, event, fn } of this.domListeners) {
      el.removeEventListener(event, fn);
    }
    this.domListeners = [];

    this.snakes = [
      {
        id: 0, name: 'You',
        body: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
        direction: 'RIGHT', nextDirection: 'RIGHT',
        alive: true, score: 0,
        bodyColor: 0xe74c3c, headColor: 0xff6b6b,
        isHuman: true,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p1-score',
      },
      {
        id: 1, name: 'AI Blue',
        body: [{ x: 25, y: 6 }, { x: 26, y: 6 }, { x: 27, y: 6 }],
        direction: 'LEFT', nextDirection: 'LEFT',
        alive: true, score: 0,
        bodyColor: 0x3498db, headColor: 0x74b9ff,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p2-score',
      },
      {
        id: 2, name: 'AI Green',
        body: [{ x: 6, y: 17 }, { x: 5, y: 17 }, { x: 4, y: 17 }],
        direction: 'RIGHT', nextDirection: 'RIGHT',
        alive: true, score: 0,
        bodyColor: 0x00b894, headColor: 0x55efc4,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p3-score',
      },
      {
        id: 3, name: 'AI Orange',
        body: [{ x: 25, y: 17 }, { x: 26, y: 17 }, { x: 27, y: 17 }],
        direction: 'LEFT', nextDirection: 'LEFT',
        alive: true, score: 0,
        bodyColor: 0xe17055, headColor: 0xfab1a0,
        isHuman: false,
        powerUp: { kind: 'none', msRemaining: 0 },
        stunnedMs: 0,
        scoreElId: 'p4-score',
      },
    ];

    this.foods = [];
    this.globalTickMs = BASE_TICK_MS;
    this.elapsed = 0;
    this.roundOver = false;
    this.challengeActive = false;

    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    this.activeChallenge = null;

    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');

    this.overlayText.setText('');
    this.overlayGraphics.clear();

    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
  }

  private allBodyCells(): Set<string> {
    const cells = new Set<string>();
    for (const snake of this.snakes) {
      if (snake.alive) {
        for (const p of snake.body) cells.add(`${p.x},${p.y}`);
      }
    }
    return cells;
  }

  private spawnFood(): void {
    const occupied = this.allBodyCells();
    for (const f of this.foods) occupied.add(`${f.x},${f.y}`);

    let fx = 0;
    let fy = 0;
    let attempts = 0;
    do {
      fx = Phaser.Math.Between(0, COLS - 1);
      fy = Phaser.Math.Between(0, ROWS - 1);
      attempts++;
    } while (occupied.has(`${fx},${fy}`) && attempts < 1000);

    this.foods.push({ x: fx, y: fy, kind: pickFoodKind() });
  }

  private queueDirection(snake: SnakeState, dir: Direction): void {
    if (dir !== OPPOSITE[snake.direction] && snake.stunnedMs <= 0) {
      snake.nextDirection = dir;
    }
  }

  private aiChooseDirection(snake: SnakeState): Direction {
    const occupied = new Set<string>();
    for (const s of this.snakes) {
      if (s.alive) {
        for (const p of s.body) occupied.add(`${p.x},${p.y}`);
      }
    }

    const head = snake.body[0];
    const candidates: Direction[] = [
      snake.direction,
      LEFT_OF[snake.direction],
      RIGHT_OF[snake.direction],
    ];

    const nearestFoodDist = (nx: number, ny: number): number => {
      let best = Infinity;
      for (const f of this.foods) {
        const d = Math.abs(f.x - nx) + Math.abs(f.y - ny);
        if (d < best) best = d;
      }
      return best;
    };

    let bestDir = snake.direction;
    let bestScore = Infinity;
    let foundValid = false;

    for (const dir of candidates) {
      const d = DELTA[dir];
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      const score = nearestFoodDist(nx, ny);
      if (!foundValid || score < bestScore) {
        bestScore = score;
        bestDir = dir;
        foundValid = true;
      }
    }

    return bestDir;
  }

  private tick(): void {
    // AI direction selection
    for (const snake of this.snakes) {
      if (!snake.alive || snake.isHuman) continue;
      snake.nextDirection = this.aiChooseDirection(snake);
    }

    const alive = this.snakes.filter((s) => s.alive);

    // Commit directions (skip if stunned)
    for (const snake of alive) {
      if (snake.stunnedMs <= 0) {
        snake.direction = snake.nextDirection;
      }
    }

    // Compute new heads
    const newHeads = new Map<number, Point>();
    for (const snake of alive) {
      const head = snake.body[0];
      const d = DELTA[snake.direction];
      newHeads.set(snake.id, { x: head.x + d.x, y: head.y + d.y });
    }

    // Border collisions
    for (const snake of alive) {
      const nh = newHeads.get(snake.id)!;
      if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) {
        snake.alive = false;
      }
    }

    const stillAlive = alive.filter((s) => s.alive);

    // Determine which snakes eat food
    const foodSet = new Set<string>(this.foods.map((f) => `${f.x},${f.y}`));
    const eatingSnakes = new Set<number>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      if (foodSet.has(`${nh.x},${nh.y}`)) eatingSnakes.add(snake.id);
    }

    // Remove tails for non-eating snakes
    for (const snake of stillAlive) {
      if (!eatingSnakes.has(snake.id)) snake.body.pop();
    }

    // Build occupied cell set (after tail removal)
    const occupied = new Set<string>();
    for (const snake of stillAlive) {
      for (const p of snake.body) occupied.add(`${p.x},${p.y}`);
    }

    // Track where each new head is going (for head-head detection)
    const headCellToSnakes = new Map<string, SnakeState[]>();
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      const key = `${nh.x},${nh.y}`;
      if (!headCellToSnakes.has(key)) headCellToSnakes.set(key, []);
      headCellToSnakes.get(key)!.push(snake);
    }

    const toKill = new Set<number>();

    // Body collisions
    for (const snake of stillAlive) {
      const nh = newHeads.get(snake.id)!;
      const nhKey = `${nh.x},${nh.y}`;
      if (occupied.has(nhKey)) {
        if (snake.isHuman && snake.powerUp.kind === 'shield') {
          // Shield only absorbs hits against other snakes' bodies (not own body)
          const isOwnBody = snake.body.some((p) => `${p.x},${p.y}` === nhKey);
          if (!isOwnBody) {
            // Absorb the hit; shield expires
            snake.powerUp = { kind: 'none', msRemaining: 0 };
          } else {
            toKill.add(snake.id);
          }
        } else {
          toKill.add(snake.id);
        }
      }
    }

    // Head-head collisions (shield cannot block these)
    for (const [, snakesAtCell] of headCellToSnakes) {
      if (snakesAtCell.length > 1) {
        for (const s of snakesAtCell) toKill.add(s.id);
      }
    }

    for (const id of toKill) {
      this.snakes[id].alive = false;
    }

    // Prepend new heads for survivors; process food effects
    const survivors = stillAlive.filter((s) => s.alive);
    const foodsEaten: string[] = [];

    for (const snake of survivors) {
      const nh = newHeads.get(snake.id)!;
      snake.body.unshift(nh);

      if (eatingSnakes.has(snake.id)) {
        const foodKey = `${nh.x},${nh.y}`;
        const food = this.foods.find((f) => `${f.x},${f.y}` === foodKey);
        if (food) {
          foodsEaten.push(foodKey);
          switch (food.kind) {
            case 'apple':
              snake.score += 10;
              // tail preserved = natural growth ✓
              break;
            case 'speed':
              snake.score += 10;
              if (snake.isHuman) snake.powerUp = { kind: 'speed', msRemaining: 5000 };
              // tail preserved = grow ✓
              break;
            case 'shield':
              snake.score += 10;
              if (snake.isHuman) snake.powerUp = { kind: 'shield', msRemaining: 5000 };
              // tail preserved = grow ✓
              break;
            case 'skull':
              // Shrink by 3 (min length 1); tail was preserved so remove 3 from back
              for (let i = 0; i < 3; i++) {
                if (snake.body.length > 1) snake.body.pop();
              }
              break;
            case 'star':
              snake.score += 50;
              // No grow: tail was preserved by eating logic, so pop it back off
              if (snake.body.length > 1) snake.body.pop();
              break;
          }
        }
      }
    }

    // Remove eaten foods and respawn
    this.foods = this.foods.filter((f) => !foodsEaten.includes(`${f.x},${f.y}`));
    while (this.foods.length < FOOD_COUNT) {
      this.spawnFood();
    }

    // Accelerate global tick slightly per food eaten
    if (foodsEaten.length > 0) {
      this.globalTickMs = Math.max(80, this.globalTickMs - 2 * foodsEaten.length);
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    if (this.roundOver || this.challengeActive) return;
    const human = this.snakes[0];
    const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);

    if (aiAlive.length === 0 && human.alive) {
      this.endRound('win', human.score);
    } else if (!human.alive) {
      // Give the player a second chance via a logic question
      this.triggerDeathChallenge();
    }
  }

  private endRound(result: 'win' | 'lose' | 'draw', score: number): void {
    this.roundOver = true;
    // Dismiss any active logic challenge so it doesn't block the game-over screen
    if (this.challengeActive) {
      if (this.challengeTimeoutId !== null) {
        clearTimeout(this.challengeTimeoutId);
        this.challengeTimeoutId = null;
      }
      const overlay = document.getElementById('challenge-overlay');
      if (overlay) overlay.classList.add('hidden');
      this.challengeActive = false;
    }
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
    let msg: string;
    if (result === 'win') {
      msg = `You Win! 🏆\nScore: ${score}\n\nSPACE to play again`;
    } else if (result === 'lose') {
      msg = `Game Over 💀\nScore: ${score}\n\nSPACE to play again`;
    } else {
      msg = 'Draw! 🤝\n\nSPACE to play again';
    }
    this.overlayText.setText(msg);
  }

  private updateScoreDisplays(): void {
    for (const snake of this.snakes) {
      const el = document.getElementById(snake.scoreElId);
      if (el) el.textContent = String(snake.score);
    }
  }

  private updatePowerUpHUD(): void {
    const human = this.snakes[0];
    if (!human) return;
    const display = document.getElementById('powerup-display');
    const timer = document.getElementById('powerup-timer');
    if (!display || !timer) return;

    if (human.stunnedMs > 0) {
      display.textContent = '😵 Stunned';
      display.style.color = '#95a5a6';
      timer.textContent = `${Math.ceil(human.stunnedMs / 1000)}s`;
      return;
    }

    const pu = human.powerUp;
    if (pu.kind === 'speed') {
      display.textContent = '⚡ Speed Boost';
      display.style.color = '#f1c40f';
      timer.textContent = `${Math.ceil(pu.msRemaining / 1000)}s`;
    } else if (pu.kind === 'shield') {
      display.textContent = '🛡 Shield';
      display.style.color = '#00cec9';
      timer.textContent = `${Math.ceil(pu.msRemaining / 1000)}s`;
    } else {
      display.textContent = 'None';
      display.style.color = '';
      timer.textContent = '';
    }
  }

  private triggerDeathChallenge(): void {
    this.challengeActive = true;
    this.activeChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];

    const questionEl = document.getElementById('challenge-question');
    const choicesEl  = document.getElementById('challenge-choices');
    const overlay    = document.getElementById('challenge-overlay');

    if (questionEl) questionEl.textContent = this.activeChallenge.question;

    if (choicesEl) {
      choicesEl.innerHTML = '';

      // Restart the timer bar animation
      const timerBar = document.getElementById('challenge-timer-bar');
      if (timerBar) {
        timerBar.style.animation = 'none';
        void timerBar.offsetWidth; // force reflow
        timerBar.style.animation = '';
      }

      const challenge = this.activeChallenge;
      challenge.choices.forEach((choice, idx) => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        const fn: EventListener = () => {
          if (!this.challengeActive) return;
          this.resolveDeathChallenge(idx === challenge.correct);
        };
        btn.addEventListener('click', fn);
        this.domListeners.push({ el: btn, event: 'click', fn });
        choicesEl.appendChild(btn);
      });
    }

    if (overlay) overlay.classList.remove('hidden');

    this.challengeTimeoutId = setTimeout(() => {
      if (this.challengeActive) this.resolveDeathChallenge(false);
    }, 6000);
  }

  private resolveDeathChallenge(correct: boolean): void {
    if (!this.challengeActive) return;
    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    this.activeChallenge = null;

    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');

    this.challengeActive = false;

    const human = this.snakes[0];
    if (correct) {
      // Revive — respawn at starting position, keep score
      human.body = [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
      human.direction = 'RIGHT';
      human.nextDirection = 'RIGHT';
      human.alive = true;
      human.stunnedMs = 0;
      human.powerUp = { kind: 'none', msRemaining: 0 };
      // Check if all AI are already dead — if so, the revived player wins
      const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);
      if (aiAlive.length === 0) {
        this.endRound('win', human.score);
      }
    } else {
      // Wrong / timed out — real game over
      const aiAlive = this.snakes.filter((s) => !s.isHuman && s.alive);
      if (aiAlive.length === 0) {
        this.endRound('draw', 0);
      } else {
        this.endRound('lose', human.score);
      }
    }

    this.updateScoreDisplays();
    this.updatePowerUpHUD();
  }

  update(_time: number, delta: number): void {
    // Tongue animation cycle (700ms: out for 220ms, retracted for 480ms)
    this.tonguePhase = (this.tonguePhase + delta) % 700;

    // Decrement power-up and stun timers for all snakes
    for (const snake of this.snakes) {
      if (snake.powerUp.msRemaining > 0) {
        snake.powerUp.msRemaining = Math.max(0, snake.powerUp.msRemaining - delta);
        if (snake.powerUp.msRemaining === 0) snake.powerUp.kind = 'none';
      }
      if (snake.stunnedMs > 0) {
        snake.stunnedMs = Math.max(0, snake.stunnedMs - delta);
      }
    }

    if (this.roundOver) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.resetGame();
      this.draw();
      return;
    }

    if (this.challengeActive) {
      this.draw();
      return;
    }

    // Handle human keyboard input (arrows + WASD)
    const human = this.snakes[0];
    if (human.alive) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keyD)) {
        this.queueDirection(human, 'RIGHT');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
        this.queueDirection(human, 'LEFT');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keyW)) {
        this.queueDirection(human, 'UP');
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS)) {
        this.queueDirection(human, 'DOWN');
      }
    }

    // Use speed boost tick rate if active
    const tickMs = (human.alive && human.powerUp.kind === 'speed')
      ? SPEED_BOOST_TICK_MS
      : this.globalTickMs;

    this.elapsed += delta;
    while (this.elapsed >= tickMs) {
      this.elapsed -= tickMs;
      this.tick();
      if (this.roundOver || this.challengeActive) break;
    }

    this.draw();
    this.updatePowerUpHUD();
  }

  /** Darken a packed RGB hex color by the given factor (0–1). */
  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g2 = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g2 << 8) | b;
  }

  private drawRealSnake(g: Phaser.GameObjects.Graphics, snake: SnakeState): void {
    const body = snake.body;
    if (body.length === 0) return;

    const BODY_R = 7;   // body segment radius
    const HEAD_R = 9;   // head radius (slightly larger)
    const TAIL_R = 4;   // tail tip radius (tapered)

    const isStunned = snake.isHuman && snake.stunnedMs > 0;
    const bodyColor = isStunned ? 0x95a5a6 : snake.bodyColor;
    const headColor = isStunned ? 0xb2bec3 : snake.headColor;
    const scaleColor = this.darkenColor(bodyColor, 0.72); // darker shade for scale texture
    const fwd = DELTA[snake.direction];
    const perp = { x: -fwd.y, y: fwd.x }; // perpendicular to direction

    // ── 1. Connecting bridges between consecutive segments ──────────────────
    // Draw filled rectangles between each pair of adjacent segment centres.
    // This fills the gap so body looks like a continuous smooth tube.
    g.fillStyle(bodyColor);
    for (let i = 0; i < body.length - 1; i++) {
      const a = body[i];
      const b2 = body[i + 1];
      const ax = a.x * CELL_SIZE + CELL_SIZE / 2;
      const ay = a.y * CELL_SIZE + CELL_SIZE / 2;
      const bx = b2.x * CELL_SIZE + CELL_SIZE / 2;
      const by = b2.y * CELL_SIZE + CELL_SIZE / 2;
      const segR = i === 0 ? HEAD_R : BODY_R;
      const nextR = i + 1 === body.length - 1 ? TAIL_R : BODY_R;
      const minR = Math.min(segR, nextR);
      if (Math.abs(ax - bx) > Math.abs(ay - by)) {
        // horizontal bridge
        g.fillRect(Math.min(ax, bx), Math.min(ay, by) - minR, Math.abs(ax - bx), minR * 2);
      } else {
        // vertical bridge
        g.fillRect(Math.min(ax, bx) - minR, Math.min(ay, by), minR * 2, Math.abs(ay - by));
      }
    }

    // ── 2. Body segment circles (tail → neck, skip head) ───────────────────
    for (let i = body.length - 1; i >= 1; i--) {
      const seg = body[i];
      const cx = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = seg.y * CELL_SIZE + CELL_SIZE / 2;
      const r = i === body.length - 1 ? TAIL_R : BODY_R;
      // Alternate scale texture every 2 segments
      g.fillStyle(i % 2 === 0 ? bodyColor : scaleColor);
      g.fillCircle(cx, cy, r);
    }

    // ── 3. Head circle ──────────────────────────────────────────────────────
    const h = body[0];
    const hcx = h.x * CELL_SIZE + CELL_SIZE / 2;
    const hcy = h.y * CELL_SIZE + CELL_SIZE / 2;
    g.fillStyle(headColor);
    g.fillCircle(hcx, hcy, HEAD_R);

    // ── 4. Eyes ─────────────────────────────────────────────────────────────
    // Position eyes forward and perpendicular from head centre
    const EYE_FWD  = 3;   // px toward front
    const EYE_SIDE = 5;   // px perpendicular from centre
    const eye1 = {
      x: hcx + fwd.x * EYE_FWD + perp.x * EYE_SIDE,
      y: hcy + fwd.y * EYE_FWD + perp.y * EYE_SIDE,
    };
    const eye2 = {
      x: hcx + fwd.x * EYE_FWD - perp.x * EYE_SIDE,
      y: hcy + fwd.y * EYE_FWD - perp.y * EYE_SIDE,
    };
    g.fillStyle(0xffffff);
    g.fillCircle(eye1.x, eye1.y, 2.5);
    g.fillCircle(eye2.x, eye2.y, 2.5);
    // Pupils — offset slightly toward front for a "looking forward" look
    g.fillStyle(0x1a1a2e);
    g.fillCircle(eye1.x + fwd.x * 0.8, eye1.y + fwd.y * 0.8, 1.5);
    g.fillCircle(eye2.x + fwd.x * 0.8, eye2.y + fwd.y * 0.8, 1.5);

    // ── 5. Tongue (animated — flicks out every 700 ms cycle) ────────────────
    const tongueOut = this.tonguePhase < 220 && !isStunned;
    if (tongueOut) {
      const TONGUE_LEN = 9;
      const FORK_LEN  = 4;
      const FORK_SPREAD = 3;
      const baseX = hcx + fwd.x * (HEAD_R + 1);
      const baseY = hcy + fwd.y * (HEAD_R + 1);
      const tipX  = baseX + fwd.x * TONGUE_LEN;
      const tipY  = baseY + fwd.y * TONGUE_LEN;
      g.lineStyle(1.5, 0xff6b9d, 1);
      // Stem
      g.beginPath(); g.moveTo(baseX, baseY); g.lineTo(tipX, tipY); g.strokePath();
      // Left fork
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX + fwd.x * FORK_LEN + perp.x * FORK_SPREAD,
               tipY + fwd.y * FORK_LEN + perp.y * FORK_SPREAD);
      g.strokePath();
      // Right fork
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(tipX + fwd.x * FORK_LEN - perp.x * FORK_SPREAD,
               tipY + fwd.y * FORK_LEN - perp.y * FORK_SPREAD);
      g.strokePath();
    }

    // ── 6. Shield ring around head ──────────────────────────────────────────
    if (snake.isHuman && snake.powerUp.kind === 'shield') {
      g.lineStyle(2.5, 0x00cec9, 1);
      g.strokeCircle(hcx, hcy, HEAD_R + 5);
    }
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();

    // Background
    g.fillStyle(0x0d1a0d);
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines (very subtle)
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
    for (const food of this.foods) {
      const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
      const r = CELL_SIZE / 2 - 2;
      switch (food.kind) {
        case 'apple':
          g.fillStyle(0xe74c3c);
          g.fillCircle(cx, cy, r);
          break;
        case 'speed':
          g.fillStyle(0xf1c40f);
          g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
          g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
          break;
        case 'shield':
          g.fillStyle(0x00cec9);
          g.fillRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
          g.fillStyle(0x0d1a0d);
          g.fillRect(food.x * CELL_SIZE + 6, food.y * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
          break;
        case 'skull':
          g.fillStyle(0x6c5ce7);
          g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
          g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
          break;
        case 'star':
          g.fillStyle(0xfdcb6e);
          g.fillCircle(cx, cy, r + 1);
          break;
      }
    }

    // Snakes — real snake rendering
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      this.drawRealSnake(g, snake);
    }
  }

  shutdown(): void {
    for (const { el, event, fn } of this.domListeners) {
      el.removeEventListener(event, fn);
    }
    this.domListeners = [];
    if (this.challengeTimeoutId !== null) {
      clearTimeout(this.challengeTimeoutId);
      this.challengeTimeoutId = null;
    }
    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');
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
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  return {
    destroy(): void {
      game.destroy(true);
    },
  };
}
