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

const startScreen = document.getElementById('start-screen');
const levelScreen = document.getElementById('level-screen');
const gameShell   = document.getElementById('game-shell');
const aboutPanel  = document.getElementById('about-panel');

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function openAbout():  void { aboutPanel?.classList.remove('hidden'); }
function closeAbout(): void { aboutPanel?.classList.add('hidden'); }
function setVersionText(): void {
  setText('start-version-value', appVersion);
  setText('version-value', appVersion);
  setText('about-version-value', appVersion);
}
function getGameModule(): Promise<typeof import('./game')> {
  if (!gameModulePromise) gameModulePromise = loadGameModule();
  return gameModulePromise;
}

// ── Level metadata (global level number → display info) ────────────────
interface LevelMeta { name: string; desc: string; }
const LEVEL_META: Record<number, LevelMeta> = {
  1:  { name: 'Fruit House Trap',      desc: 'Enter the house 🏠 · Eat fruits · Avoid snakes · Escape!' },
  2:  { name: 'Narrow Trail',         desc: 'Precision control · Thinner path · No enemies' },
  3:  { name: 'Bamboo Bridge',        desc: 'Very narrow · One mistake = fall 🌉' },
  4:  { name: 'Split Paths',          desc: 'Fork roads · Dead ends · No enemies' },
  5:  { name: 'First Enemy',          desc: '1 slow enemy · Medium path · Stay alert' },
  6:  { name: 'Dark Forest',          desc: 'Fog of war · Limited vision · 1 enemy 🌑' },
  7:  { name: 'Cliff Edge Chaos',     desc: 'Narrow S-curve · 2 enemies · High pressure' },
  8:  { name: 'Maze Survival',        desc: 'Complex maze · Dead ends as traps · 2 enemies' },
  9:  { name: 'Storm Mountain',       desc: 'Wind pushes you · 3 fast enemies · Chaos 🌪️' },
  10: { name: 'FINAL: Serpent Arena', desc: '4 enemies · Fast speed · NO MERCY 💀' },
  // Explorer bonus
  11: { name: '⭐ Fruit Rush',         desc: 'Huge field · Tons of food · Relax & collect 🍎' },
  12: { name: '⭐ Practice Field',     desc: 'Open canvas · No walls · Free movement' },
  // Survivor bonus
  13: { name: '⭐ Hunter Chase',       desc: 'Enemy hunts you relentlessly · Run! 👀' },
  14: { name: '⭐ Timed Escape',       desc: 'Tight corridor · 2 enemies · 1 life ⏱️' },
  15: { name: '⭐ Trap Field',         desc: 'Hidden poison traps · 2 enemies ☠️' },
  // Legend bonus
  16: { name: '⭐ Poison Run',         desc: 'Navigate toxic tile gauntlet ☠️' },
  17: { name: '⭐ Mirror Maze',        desc: 'Controls REVERSED · Maze · 2 enemies 😵' },
  18: { name: '⭐ Double Speed',       desc: 'Everything blazing fast ⚡' },
  19: { name: '⭐ No Vision',          desc: 'Almost completely dark · 3 enemies 🌑' },
  20: { name: '⭐ Endless Arena',      desc: 'Survive 3 minutes vs 5 enemies · No exit 🏟️' },
};

// ── Mode definitions ─────────────────────────────────────────────────────
interface ModeConfig {
  icon: string; title: string; tagline: string; badge: string; badgeClass: string;
  mainLevels: number[];
  bonusLevels: number[];
  unlockAfterLevel: number | null; // null = always open
  bonusUnlockAfterLevel: number;   // finishing this level unlocks bonus
}
const MODES: Record<GameMode, ModeConfig> = {
  explorer: {
    icon: '🌿', title: 'Explorer Mode', tagline: 'Learn & Relax · No pressure',
    badge: 'Easy', badgeClass: 'badge-easy',
    mainLevels: [1, 2, 3, 4],
    bonusLevels: [11, 12],
    unlockAfterLevel: null,
    bonusUnlockAfterLevel: 3,
  },
  survivor: {
    icon: '⚔️', title: 'Survivor Mode', tagline: 'Real game starts · Strategy + reflex',
    badge: 'Medium', badgeClass: 'badge-medium',
    mainLevels: [4, 5, 6, 7],
    bonusLevels: [13, 14, 15],
    unlockAfterLevel: 3,
    bonusUnlockAfterLevel: 7,
  },
  legend: {
    icon: '🔥', title: 'Legend Mode', tagline: 'Master Tier · Extreme survival',
    badge: 'Hard', badgeClass: 'badge-hard',
    mainLevels: [8, 9, 10],
    bonusLevels: [16, 17, 18, 19, 20],
    unlockAfterLevel: 7,
    bonusUnlockAfterLevel: 10,
  },
};

// ── Progress helpers ──────────────────────────────────────────────────────
function getCompleted(): number[] {
  try { return JSON.parse(localStorage.getItem('venom_completed') ?? '[]') as number[]; }
  catch { return []; }
}
function markCompleted(level: number): void {
  const c = getCompleted();
  if (!c.includes(level)) { c.push(level); localStorage.setItem('venom_completed', JSON.stringify(c)); }
}
function isModeUnlocked(_mode: GameMode): boolean {
  return true;  // all modes always unlocked
}
function isLevelUnlocked(level: number, modeKey: GameMode): boolean {
  const mode = MODES[modeKey];
  const allLevels = [...mode.mainLevels, ...mode.bonusLevels];
  return allLevels.includes(level);  // all levels always unlocked
}

// ── Next level in mode sequence ───────────────────────────────────────────
function nextLevelInMode(mode: GameMode, current: number): number | null {
  const seq = [...MODES[mode].mainLevels, ...MODES[mode].bonusLevels];
  const idx = seq.indexOf(current);
  return idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
}

// ── Navigation ────────────────────────────────────────────────────────────
function showStartScreen(): void {
  levelScreen?.classList.add('hidden');
  gameShell?.classList.add('hidden');
  startScreen?.classList.remove('hidden');
  const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
  if (bgCanvas && !bgAnim) bgAnim = startBgAnimation(bgCanvas);
  // Refresh mode card lock states
  for (const key of Object.keys(MODES) as GameMode[]) {
    const card = document.querySelector<HTMLElement>(`.mode-card[data-mode="${key}"]`);
    if (!card) continue;
    const locked = !isModeUnlocked(key);
    card.classList.toggle('locked', locked);
    const lockEl = card.querySelector<HTMLElement>('.mode-lock');
    if (lockEl) lockEl.textContent = locked ? '🔒' : '';
  }
}

function showLevelScreen(mode: GameMode): void {
  selectedMode = mode;
  const cfg = MODES[mode];

  setText('level-mode-icon',    cfg.icon);
  setText('level-mode-title',   cfg.title);
  setText('level-mode-tagline', cfg.tagline);

  const cards = document.getElementById('level-cards')!;
  cards.innerHTML = '';

  // ── Main levels section ────────────────────────────────────────────
  const mainHeader = document.createElement('div');
  mainHeader.className = 'level-section-header';
  mainHeader.textContent = '📋 Main Levels';
  cards.appendChild(mainHeader);

  for (const lvl of cfg.mainLevels) {
    cards.appendChild(buildLevelCard(lvl, mode, false));
  }

  // ── Bonus levels section ───────────────────────────────────────────
  const bonusHeader = document.createElement('div');
  bonusHeader.className = 'level-section-header bonus-header';
  const bonusLocked = !getCompleted().includes(cfg.bonusUnlockAfterLevel);
  bonusHeader.innerHTML = `⭐ Bonus Levels${bonusLocked ? ' <span class="bonus-lock-hint">(finish Level ${cfg.bonusUnlockAfterLevel} to unlock)</span>' : ''}`;
  cards.appendChild(bonusHeader);

  for (const lvl of cfg.bonusLevels) {
    cards.appendChild(buildLevelCard(lvl, mode, true));
  }

  startScreen?.classList.add('hidden');
  levelScreen?.classList.remove('hidden');
  const lvlCanvas = document.getElementById('level-bg-canvas') as HTMLCanvasElement | null;
  if (lvlCanvas && !bgAnim) bgAnim = startBgAnimation(lvlCanvas);
}

function buildLevelCard(lvl: number, mode: GameMode, isBonus: boolean): HTMLDivElement {
  const meta = LEVEL_META[lvl];
  const unlocked = isLevelUnlocked(lvl, mode);
  const completed = getCompleted().includes(lvl);
  const div = document.createElement('div');
  div.className = `level-select-card${isBonus ? ' bonus-card' : ''}${unlocked ? '' : ' locked'}`;
  div.dataset.level = String(lvl);
  div.innerHTML = `
    <span class="lvl-num">${completed ? '✅' : (unlocked ? '▶' : '🔒')} ${lvl}</span>
    <div class="lvl-info">
      <span class="lvl-name">${meta.name}</span>
      <span class="lvl-desc">${meta.desc}</span>
    </div>
  `;
  if (unlocked) {
    div.addEventListener('click', () => {
      selectedLevel = lvl;
      void startGame();
    });
  }
  return div;
}

// ── Start game ────────────────────────────────────────────────────────────
async function startGame(): Promise<void> {
  if (isStarting) return;
  if (gameController) { gameController.destroy(); gameController = null; }
  isStarting = true;
  try {
    const { createGame } = await getGameModule();
    gameController = createGame({
      bodyColor: selectedBodyColor,
      headColor: selectedHeadColor,
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

// ── Event listeners ────────────────────────────────────────────────────────

// Mode card clicks
document.getElementById('mode-select')?.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.mode-card[data-mode]');
  if (!card) return;
  const mode = card.dataset.mode as GameMode;
  if (!isModeUnlocked(mode)) return;
  showLevelScreen(mode);
});

// Back button
document.getElementById('back-to-modes')?.addEventListener('click', showStartScreen);

// Level complete
window.addEventListener('snake-level-complete', (e: Event) => {
  const { level } = (e as CustomEvent<{ level: number }>).detail;
  markCompleted(level);
});

// Menu button
document.getElementById('menu-button')?.addEventListener('click', () => {
  gameController?.destroy();
  gameController = null;
  gameShell?.classList.add('hidden');
  document.getElementById('retry-btn')?.classList.add('hidden');
  document.getElementById('next-level-btn')?.classList.add('hidden');
  showStartScreen();
});

// Retry (play again — same level)
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

// Next Level (advance within current mode sequence)
document.getElementById('next-level-btn')?.addEventListener('click', () => {
  const next = nextLevelInMode(selectedMode, selectedLevel);
  if (next !== null && isLevelUnlocked(next, selectedMode)) {
    selectedLevel = next;
    void startGame();
  } else if (next !== null) {
    // Next exists but not yet unlocked (bonus lock) — go back to level select
    gameController?.destroy();
    gameController = null;
    gameShell?.classList.add('hidden');
    showLevelScreen(selectedMode);
  } else {
    // End of mode
    gameController?.destroy();
    gameController = null;
    gameShell?.classList.add('hidden');
    showStartScreen();
  }
});

// About
document.getElementById('start-about-button')?.addEventListener('click', openAbout);
document.getElementById('about-button')?.addEventListener('click', openAbout);
document.getElementById('close-about')?.addEventListener('click', closeAbout);
aboutPanel?.addEventListener('click', (e) => { if (e.target === aboutPanel) closeAbout(); });

// ── Init ──────────────────────────────────────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
if (bgCanvas) bgAnim = startBgAnimation(bgCanvas);
setVersionText();

// Prevent browser zoom gestures (trackpad pinch, Ctrl/Cmd+scroll) so the
// game always fits the window without needing Cmd+0 to reset zoom.
window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
window.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
