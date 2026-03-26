import Phaser from 'phaser';

export interface GameController { destroy(): void; }

const CELL_SIZE = 20;
const COLS = 32;
const ROWS = 24;
const CANVAS_W = COLS * CELL_SIZE; // 640
const CANVAS_H = ROWS * CELL_SIZE; // 480

type GameMode = 'explorer' | 'survivor' | 'legend';

interface ModeConfig {
  snakeCount: number;
  glorySpeed: number;
  snakeTickMs: number;
  lives: number;
  scoreMultiplier: number;
  survivalGoals: [number, number, number];
}

const MODE_CONFIGS: Record<GameMode, ModeConfig> = {
  explorer: { snakeCount: 3, glorySpeed: 2.5, snakeTickMs: 320, lives: 3, scoreMultiplier: 1, survivalGoals: [60, 120, 180] },
  survivor: { snakeCount: 5, glorySpeed: 2.8, snakeTickMs: 220, lives: 2, scoreMultiplier: 2, survivalGoals: [60, 120, 180] },
  legend:   { snakeCount: 8, glorySpeed: 3.2, snakeTickMs: 160, lives: 1, scoreMultiplier: 3, survivalGoals: [60, 120, 180] },
};

let gameMode: GameMode = 'explorer';
let gameLevel: 1 | 2 | 3 = 1;

type PowerUpKind = 'flashlight' | 'trap' | 'speed' | 'hint';

interface Point { x: number; y: number; }

interface SnakeEnemy {
  id: number;
  segments: Point[];
  alive: boolean;
  stunnedMs: number;
  color: number;
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

// Static terrain features generated once
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

  // Three rendering layers
  private bgGraphics!: Phaser.GameObjects.Graphics;   // terrain + snakes
  private overlayGraphics!: Phaser.GameObjects.Graphics; // flashlight overlay
  private topGraphics!: Phaser.GameObjects.Graphics;  // Glory + in-game HUD

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
    const config = MODE_CONFIGS[gameMode];

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

    this.startSnakeTimer();
  }

  private startSnakeTimer(): void {
    this.snakeTickTimer?.remove();
    const lvlMult = gameLevel === 1 ? 1.0 : gameLevel === 2 ? 0.78 : 0.62;
    const tickMs = Math.floor(MODE_CONFIGS[gameMode].snakeTickMs * lvlMult);
    this.snakeTickTimer = this.time.addEvent({
      delay: tickMs,
      callback: this.tickSnakes,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnSnake(): void {
    const id = this.snakes.length;
    const color = SNAKE_COLORS[id % SNAKE_COLORS.length];
    const edge = Math.floor(Math.random() * 4);
    let hx: number, hy: number;
    if (edge === 0)      { hx = Math.floor(Math.random() * COLS); hy = 0; }
    else if (edge === 1) { hx = COLS - 1; hy = Math.floor(Math.random() * ROWS); }
    else if (edge === 2) { hx = Math.floor(Math.random() * COLS); hy = ROWS - 1; }
    else                 { hx = 0; hy = Math.floor(Math.random() * ROWS); }

    // Keep away from Glory's starting cell
    const gc = this.gloryCell();
    if (Math.abs(hx - gc.x) < 5 && Math.abs(hy - gc.y) < 5) {
      hx = (hx + COLS / 2) % COLS;
      hy = (hy + ROWS / 2) % ROWS;
    }

    const segs: Point[] = [{ x: hx, y: hy }, { x: hx, y: hy }, { x: hx, y: hy }];
    this.snakes.push({ id, segments: segs, alive: true, stunnedMs: 0, color });
  }

  private gloryCell(): Point {
    return {
      x: Math.max(0, Math.min(COLS - 1, Math.floor(this.glory.x / CELL_SIZE))),
      y: Math.max(0, Math.min(ROWS - 1, Math.floor(this.glory.y / CELL_SIZE))),
    };
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

      const head = snake.segments[0];
      const dx = gc.x - head.x;
      const dy = gc.y - head.y;

      let nx = head.x;
      let ny = head.y;

      if (dx === 0 && dy === 0) {
        // Already on top — skip
      } else if (Math.abs(dx) >= Math.abs(dy)) {
        nx = head.x + Math.sign(dx);
      } else {
        ny = head.y + Math.sign(dy);
      }

      nx = Math.max(0, Math.min(COLS - 1, nx));
      ny = Math.max(0, Math.min(ROWS - 1, ny));

      // Shift segments
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
  }

  update(_time: number, delta: number): void {
    if (this.roundOver) return;

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

    // Move Glory
    if (this.pointerDown && this.dragDir) {
      const spd = this.activePowerUp?.kind === 'speed'
        ? this.glory.speed * 1.8
        : this.glory.speed;
      this.glory.x = Math.max(12, Math.min(CANVAS_W - 12, this.glory.x + this.dragDir.dx * spd));
      this.glory.y = Math.max(12, Math.min(CANVAS_H - 12, this.glory.y + this.dragDir.dy * spd));
    }

    // Collision check
    if (this.glory.invincibleMs <= 0) {
      this.checkCollision();
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

    // Check win
    const goal = MODE_CONFIGS[gameMode].survivalGoals[gameLevel - 1];
    if (this.survivalMs >= goal * 1000) {
      this.winGame();
      return;
    }

    this.score = Math.floor((this.survivalMs / 1000) * MODE_CONFIGS[gameMode].scoreMultiplier);

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

  // ── Susie helper ─────────────────────────────────────────────────────────
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

  // ── DOM ───────────────────────────────────────────────────────────────────
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

    const goal = MODE_CONFIGS[gameMode].survivalGoals[gameLevel - 1];
    const progressBar = document.getElementById('survival-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, (this.survivalMs / 1000 / goal) * 100).toFixed(1)}%`;
    }

    const goalEl = document.getElementById('survival-goal-label');
    if (goalEl) {
      const g = goal;
      goalEl.textContent = `Survive ${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`;
    }
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  private drawScene(): void {
    this.bgGraphics.clear();
    this.topGraphics.clear();
    this.overlayGraphics.clear();

    this.drawBackground();
    this.drawSnakes();

    if (this.activePowerUp?.kind === 'flashlight') {
      // Dark overlay: everything behind is dimmed; Glory on topGraphics is always bright
      this.overlayGraphics.fillStyle(0x000000, 0.86);
      this.overlayGraphics.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Glow ring to indicate flashlight boundary
      this.overlayGraphics.lineStyle(3, 0xffee88, 0.4);
      this.overlayGraphics.strokeCircle(this.glory.x, this.glory.y, 82);
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

    // Rock shapes
    this.bgGraphics.fillStyle(0x14181e);
    for (const rock of TERRAIN_ROCKS) {
      this.bgGraphics.fillEllipse(rock.x, rock.y, rock.rw, rock.rh);
    }

    // Dotted paths
    this.bgGraphics.fillStyle(0x1c2030, 0.7);
    for (let i = 0; i < CANVAS_W; i += 22) {
      this.bgGraphics.fillCircle(i, CANVAS_H / 2, 1.2);
    }
    for (let i = 0; i < 28; i++) {
      this.bgGraphics.fillCircle(i * 24, i * 18, 1.2);
    }
    // Second diagonal
    for (let i = 0; i < 20; i++) {
      this.bgGraphics.fillCircle(CANVAS_W - i * 32, i * 24, 1.2);
    }
  }

  private drawSnakes(): void {
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const stunned = snake.stunnedMs > 0;
      const alpha = stunned ? 0.45 : 1.0;
      const bodyAlpha = stunned ? 0.3 : 0.75;

      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const seg = snake.segments[i];
        const px = seg.x * CELL_SIZE + CELL_SIZE / 2;
        const py = seg.y * CELL_SIZE + CELL_SIZE / 2;

        if (i === 0) {
          // Head
          this.bgGraphics.fillStyle(snake.color, alpha);
          this.bgGraphics.fillCircle(px, py, 9);
          // Eyes
          this.bgGraphics.fillStyle(0xffffff, alpha);
          this.bgGraphics.fillCircle(px - 3, py - 2, 2);
          this.bgGraphics.fillCircle(px + 3, py - 2, 2);
          this.bgGraphics.fillStyle(0x111111, alpha);
          this.bgGraphics.fillCircle(px - 2.5, py - 2, 1.2);
          this.bgGraphics.fillCircle(px + 3.5, py - 2, 1.2);
          // Stun stars
          if (stunned) {
            this.bgGraphics.fillStyle(0xffff00, 0.8);
            this.bgGraphics.fillCircle(px, py - 14, 3);
            this.bgGraphics.fillCircle(px - 8, py - 10, 2);
            this.bgGraphics.fillCircle(px + 8, py - 10, 2);
          }
        } else {
          this.bgGraphics.fillStyle(snake.color, i % 2 === 0 ? alpha : bodyAlpha);
          this.bgGraphics.fillCircle(px, py, 7);
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

    // Direction indicator
    if (this.dragDir) {
      const fx = x + this.dragDir.dx * 8;
      const fy = y + this.dragDir.dy * 8;
      this.topGraphics.fillStyle(0xffffff, 0.9);
      this.topGraphics.fillCircle(fx, fy, 3.5);
    }

    // Rim
    this.topGraphics.lineStyle(2, rimColor, 0.9);
    this.topGraphics.strokeCircle(x, y, 12);

    // Speed boost glow
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

    // Arrowhead
    const perpX = -ny * 5;
    const perpY =  nx * 5;
    this.topGraphics.fillStyle(0xffff00, 0.95);
    this.topGraphics.fillTriangle(
      ax, ay,
      ax - nx * 10 + perpX, ay - ny * 10 + perpY,
      ax - nx * 10 - perpX, ay - ny * 10 - perpY,
    );
  }

  // ── Round end ─────────────────────────────────────────────────────────────
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
    this.score = Math.floor((this.survivalMs / 1000) * MODE_CONFIGS[gameMode].scoreMultiplier);
    this.updateDOM();
    this.showEndOverlay(`🏆 You Survived!\nScore: ${this.score}`);
  }

  private resetGame(): void {
    document.getElementById('retry-btn')?.classList.add('hidden');
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
  }
}

export function createGame(opts: { bodyColor?: number; headColor?: number; mode: GameMode; level: 1 | 2 | 3 }): GameController {
  // bodyColor and headColor accepted for API compatibility; Glory uses fixed green palette
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
    },
  };
}
