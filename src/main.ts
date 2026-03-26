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
let selectedLevel: number = 1;

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

const LEVEL_NAMES: Record<GameMode, string[]> = {
  explorer: ['Basic Movement', 'Open Fields', 'Fences', 'First Maze', 'Mini Challenge'],
  survivor: ['Intro Survival', 'Narrow Paths', 'Bamboo Bridge', 'Split Path', 'First Hunter', 'Dark Forest', 'Speed + Obstacles', 'Maze Survival', 'Multiple Enemies', 'Boss Stage'],
  legend: ['Fast Start', 'Tight Corridor', 'Double Chase', 'IQ Gate Traps', 'Maze + Blind', 'Speed Ramp', 'Poison Zones', 'Multi Traps', 'Vision + Enemies', 'Mini Boss', 'Moving Obstacles', 'High-Speed Chase', 'IQ + Move Combo', 'No Safe Zones', 'FINAL VENOM ARENA'],
};

function getProgress(mode: GameMode): number[] {
  try { return JSON.parse(localStorage.getItem(`venom_progress_${mode}`) ?? '[]') as number[]; }
  catch { return []; }
}
function saveProgress(mode: GameMode, level: number): void {
  const p = getProgress(mode);
  if (!p.includes(level)) { p.push(level); localStorage.setItem(`venom_progress_${mode}`, JSON.stringify(p)); }
}
function isLevelUnlocked(mode: GameMode, level: number): boolean {
  if (mode === 'explorer' && level === 1) return true;
  if (mode === 'survivor' && level === 1) return getProgress('explorer').includes(5);
  if (mode === 'legend' && level === 1) return getProgress('survivor').includes(10);
  return getProgress(mode).includes(level - 1);
}

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

  const levelCards = document.getElementById('level-cards')!;
  levelCards.innerHTML = '';
  const levelCount = { explorer: 5, survivor: 10, legend: 15 }[mode];
  for (let i = 1; i <= levelCount; i++) {
    const lvl = i;
    const unlocked = isLevelUnlocked(mode, lvl);
    const div = document.createElement('div');
    div.className = `level-select-card${unlocked ? '' : ' locked'}`;
    div.dataset.level = String(lvl);
    div.innerHTML = `
      <span class="lvl-num">Lv ${lvl}</span>
      <span class="lvl-name">${LEVEL_NAMES[mode][lvl - 1]}</span>
      <span class="lvl-lock">${unlocked ? '' : '🔒'}</span>
    `;
    if (unlocked) {
      div.addEventListener('click', () => {
        selectedLevel = lvl;
        void startGame();
      });
    }
    levelCards.appendChild(div);
  }

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

// Mode card → level screen
document.getElementById('mode-select')?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.mode-card');
  if (!card || !card.dataset.mode) return;
  selectedMode = card.dataset.mode as GameMode;
  showLevelScreen(selectedMode);
});

// Back button on level screen
document.getElementById('back-to-modes')?.addEventListener('click', showModeSelect);

// Level card clicks are set up per-card in showLevelScreen()

// Level-complete handler
window.addEventListener('snake-level-complete', (e: Event) => {
  const { mode, level } = (e as CustomEvent<{ mode: GameMode; level: number }>).detail;
  saveProgress(mode, level);
});

// Menu button in game shell → back to mode select (destroys game)
document.getElementById('menu-button')?.addEventListener('click', () => {
  gameController?.destroy();
  gameController = null;
  gameShell?.classList.add('hidden');
  document.getElementById('retry-btn')?.classList.add('hidden');
  document.getElementById('next-level-btn')?.classList.add('hidden');
  showModeSelect();
});

// Retry (same level on death)
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

// Next Level (advance after winning)
const MODE_MAX_LEVELS: Record<GameMode, number> = { explorer: 5, survivor: 10, legend: 15 };
document.getElementById('next-level-btn')?.addEventListener('click', () => {
  const maxLevel = MODE_MAX_LEVELS[selectedMode];
  if (selectedLevel < maxLevel) {
    selectedLevel += 1;
    void startGame();
  } else {
    // Last level of mode complete — go back to mode select
    gameController?.destroy();
    gameController = null;
    gameShell?.classList.add('hidden');
    showModeSelect();
  }
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
