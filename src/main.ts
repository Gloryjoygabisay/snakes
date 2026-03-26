import './styles.css';
import type { GameController } from './game';
import { loadGameModule } from './game-loader';
import { startBgAnimation } from './bg-snakes';
import packageJson from '../package.json';

type GameMode = 'explorer' | 'survivor' | 'legend';

const appVersion = import.meta.env.VITE_APP_VERSION || packageJson.version;

let gameController: GameController | null = null;
let gameModulePromise: Promise<typeof import('./game')> | null = null;
let isStarting = false;
let bgAnim: { stop: () => void; setColors: (b: string, h: string) => void } | null = null;

let selectedBodyColor = 0xe74c3c;
let selectedHeadColor = 0xff6b6b;
let selectedMode: GameMode = 'explorer';
let selectedLevel: 1 | 2 | 3 = 1;

// ── DOM refs ──────────────────────────────────────────────────
const startScreen  = document.getElementById('start-screen');
const levelScreen  = document.getElementById('level-screen');
const gameShell    = document.getElementById('game-shell');
const aboutPanel   = document.getElementById('about-panel');

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function openAbout():  void { aboutPanel?.classList.remove('hidden'); }
function closeAbout(): void { aboutPanel?.classList.add('hidden'); }

function setVersionText(): void {
  setText('start-version-value', appVersion);
  setText('version-value',       appVersion);
  setText('about-version-value', appVersion);
}

function getGameModule(): Promise<typeof import('./game')> {
  if (!gameModulePromise) gameModulePromise = loadGameModule();
  return gameModulePromise;
}

// ── Mode + level metadata ────────────────────────────────────
const MODE_META: Record<GameMode, {
  icon: string; title: string; tagline: string;
  levels: Array<{ name: string; speed: string }>;
}> = {
  explorer: {
    icon: '🌿', title: 'Explorer Mode', tagline: 'Casual & relaxed · No revival',
    levels: [
      { name: 'Wanderer', speed: '🐢 Slow' },
      { name: 'Tracker',  speed: '🐇 Medium' },
      { name: 'Pioneer',  speed: '🚀 Fast' },
    ],
  },
  survivor: {
    icon: '⚔️', title: 'Survivor Mode', tagline: 'Answer trivia to revive · Medium speed',
    levels: [
      { name: 'Recruit', speed: '🐢 Slow' },
      { name: 'Warrior', speed: '🐇 Medium' },
      { name: 'Veteran', speed: '🚀 Fast' },
    ],
  },
  legend: {
    icon: '🔥', title: 'Legend Mode', tagline: 'One revival only · Blazing fast',
    levels: [
      { name: 'Spark',   speed: '🐇 Medium' },
      { name: 'Blaze',   speed: '🚀 Fast' },
      { name: 'Inferno', speed: '⚡ Blazing' },
    ],
  },
};

// ── Navigation helpers ────────────────────────────────────────
function showModeSelect(): void {
  levelScreen?.classList.add('hidden');
  gameShell?.classList.add('hidden');
  startScreen?.classList.remove('hidden');
  const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
  if (bgCanvas && !bgAnim) bgAnim = startBgAnimation(bgCanvas);
}

function showLevelScreen(mode: GameMode): void {
  const meta = MODE_META[mode];
  setText('level-mode-icon',    meta.icon);
  setText('level-mode-title',   meta.title);
  setText('level-mode-tagline', meta.tagline);

  meta.levels.forEach((lv, i) => {
    setText(`lvl${i + 1}-name`,  lv.name);
    setText(`lvl${i + 1}-speed`, lv.speed);
  });

  levelScreen?.setAttribute('data-mode', mode);

  startScreen?.classList.add('hidden');
  levelScreen?.classList.remove('hidden');

  const lvlCanvas = document.getElementById('level-bg-canvas') as HTMLCanvasElement | null;
  if (lvlCanvas && !bgAnim) bgAnim = startBgAnimation(lvlCanvas);
}

// ── Start game ───────────────────────────────────────────────
async function startGame(): Promise<void> {
  if (isStarting) return;
  if (gameController) {
    gameController.destroy();
    gameController = null;
  }
  isStarting = true;
  try {
    const { createGame } = await getGameModule();
    gameController = createGame({
      bodyColor: selectedBodyColor,
      headColor: selectedHeadColor,
      mode: selectedMode,
      level: selectedLevel,
    });
  } catch {
    isStarting = false;
    return;
  }
  isStarting = false;

  bgAnim?.stop();
  bgAnim = null;
  levelScreen?.classList.add('hidden');
  startScreen?.classList.add('hidden');
  gameShell?.classList.remove('hidden');
}

// ── Event listeners ──────────────────────────────────────────

// Color swatches
document.getElementById('color-swatches')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.color-swatch');
  if (!btn) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  selectedBodyColor = parseInt((btn.dataset.body ?? 'e74c3c').replace('#', ''), 16);
  selectedHeadColor = parseInt((btn.dataset.head ?? 'ff6b6b').replace('#', ''), 16);
  bgAnim?.setColors(btn.dataset.body ?? '#e74c3c', btn.dataset.head ?? '#ff6b6b');
});

// Mode card → level screen
document.getElementById('mode-select')?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.mode-card');
  if (!card || !card.dataset.mode) return;
  selectedMode = card.dataset.mode as GameMode;
  showLevelScreen(selectedMode);
});

// Back button on level screen
document.getElementById('back-to-modes')?.addEventListener('click', showModeSelect);

// Level card → start game
document.getElementById('level-cards')?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.level-select-card');
  if (!card || !card.dataset.level) return;
  selectedLevel = parseInt(card.dataset.level) as 1 | 2 | 3;
  void startGame();
});

// Menu button in game shell → back to mode select (destroys game)
document.getElementById('menu-button')?.addEventListener('click', () => {
  gameController?.destroy();
  gameController = null;
  gameShell?.classList.add('hidden');
  showModeSelect();
});

// Retry
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

// About
document.getElementById('start-about-button')?.addEventListener('click', openAbout);
document.getElementById('about-button')?.addEventListener('click', openAbout);
document.getElementById('close-about')?.addEventListener('click', closeAbout);
aboutPanel?.addEventListener('click', (e) => { if (e.target === aboutPanel) closeAbout(); });

// ── Init ─────────────────────────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
if (bgCanvas) bgAnim = startBgAnimation(bgCanvas);
setVersionText();
