import './styles.css';
import type { GameController } from './game';
import { loadGameModule } from './game-loader';
import { startBgAnimation } from './bg-snakes';
import packageJson from '../package.json';

const appVersion = import.meta.env.VITE_APP_VERSION || packageJson.version;

let gameController: GameController | null = null;
let gameModulePromise: Promise<typeof import('./game')> | null = null;
let isStarting = false;
let bgAnim: { stop: () => void; setColors: (b: string, h: string) => void } | null = null;

let selectedBodyColor = 0xe74c3c;
let selectedHeadColor = 0xff6b6b;
let selectedLevel: number = 1;

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

const LEVEL_META: Array<{ name: string; icon: string; desc: string; color: string }> = [
  { name: 'Mountain Path',        icon: '🟢', desc: 'Learn controls · Wide road · No enemies',          color: 'easy' },
  { name: 'Narrow Trail',         icon: '🟢', desc: 'Precision control · Thinner path · No enemies',     color: 'easy' },
  { name: 'Bamboo Bridge',        icon: '🟡', desc: 'Careful movement · Very narrow · One mistake = fall', color: 'medium' },
  { name: 'Split Paths',          icon: '🟡', desc: 'Decision making · Fork roads · Dead ends ahead',    color: 'medium' },
  { name: 'First Enemy',          icon: '🟠', desc: 'Awareness · 1 slow enemy · Medium path',            color: 'hard' },
  { name: 'Dark Forest',          icon: '🟠', desc: 'Limited vision · Fog of war · 1 enemy',             color: 'hard' },
  { name: 'Cliff Edge Chaos',     icon: '🔴', desc: 'High pressure · Narrow curves · 2 enemies',         color: 'danger' },
  { name: 'Maze Survival',        icon: '🔴', desc: 'Strategy · Complex maze · Dead ends everywhere',    color: 'danger' },
  { name: 'Storm Mountain',       icon: '🔥', desc: 'Wind chaos · Obstacles · 3 fast enemies',           color: 'extreme' },
  { name: 'FINAL: Serpent Arena', icon: '💀', desc: 'EVERYTHING · 4 enemies · Fast speed · No mercy',   color: 'extreme' },
];

function getProgress(): number[] {
  try { return JSON.parse(localStorage.getItem('venom_progress_campaign') ?? '[]') as number[]; }
  catch { return []; }
}
function saveProgress(level: number): void {
  const p = getProgress();
  if (!p.includes(level)) { p.push(level); localStorage.setItem('venom_progress_campaign', JSON.stringify(p)); }
}
function isLevelUnlocked(level: number): boolean {
  if (level === 1) return true;
  return getProgress().includes(level - 1);
}

function showStartScreen(): void {
  levelScreen?.classList.add('hidden');
  gameShell?.classList.add('hidden');
  startScreen?.classList.remove('hidden');
  const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
  if (bgCanvas && !bgAnim) bgAnim = startBgAnimation(bgCanvas);
}

function showLevelScreen(): void {
  const levelCards = document.getElementById('level-cards')!;
  levelCards.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const lvl = i;
    const meta = LEVEL_META[lvl - 1];
    const unlocked = isLevelUnlocked(lvl);
    const div = document.createElement('div');
    div.className = `level-select-card level-card-${meta.color}${unlocked ? '' : ' locked'}`;
    div.dataset.level = String(lvl);
    div.innerHTML = `
      <span class="lvl-num">${meta.icon} ${lvl}</span>
      <div class="lvl-info">
        <span class="lvl-name">${meta.name}</span>
        <span class="lvl-desc">${meta.desc}</span>
      </div>
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

  startScreen?.classList.add('hidden');
  levelScreen?.classList.remove('hidden');
  const lvlCanvas = document.getElementById('level-bg-canvas') as HTMLCanvasElement | null;
  if (lvlCanvas && !bgAnim) bgAnim = startBgAnimation(lvlCanvas);
}

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

// Play button → level select
document.getElementById('play-btn')?.addEventListener('click', showLevelScreen);

// Back button on level screen
document.getElementById('back-to-modes')?.addEventListener('click', showStartScreen);

// Level-complete handler
window.addEventListener('snake-level-complete', (e: Event) => {
  const { level } = (e as CustomEvent<{ level: number }>).detail;
  saveProgress(level);
});

// Menu button → back to start
document.getElementById('menu-button')?.addEventListener('click', () => {
  gameController?.destroy();
  gameController = null;
  gameShell?.classList.add('hidden');
  document.getElementById('retry-btn')?.classList.add('hidden');
  document.getElementById('next-level-btn')?.classList.add('hidden');
  showStartScreen();
});

// Retry (same level on death)
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

// Next Level (advance after winning)
document.getElementById('next-level-btn')?.addEventListener('click', () => {
  if (selectedLevel < 10) {
    selectedLevel += 1;
    void startGame();
  } else {
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

// Init
const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
if (bgCanvas) bgAnim = startBgAnimation(bgCanvas);
setVersionText();
