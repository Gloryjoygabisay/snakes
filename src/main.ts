import './styles.css';
import type { GameController } from './game';
import { loadGameModule } from './game-loader';
import { startBgAnimation } from './bg-snakes';
import packageJson from '../package.json';

let gameController: GameController | null = null;
let gameModulePromise: Promise<typeof import('./game')> | null = null;
let isStarting = false;
let stopBgAnim: (() => void) | null = null;
const appVersion = import.meta.env.VITE_APP_VERSION || packageJson.version;

// Track selected snake color (defaults to red)
let selectedBodyColor = 0xe74c3c;
let selectedHeadColor = 0xff6b6b;

const startScreen  = document.getElementById('start-screen');
const gameShell    = document.getElementById('game-shell');
const aboutPanel   = document.getElementById('about-panel');
const startButton  = document.getElementById('start-button') as HTMLButtonElement | null;
const startAboutButton  = document.getElementById('start-about-button') as HTMLButtonElement | null;
const aboutButton  = document.getElementById('about-button') as HTMLButtonElement | null;
const closeAboutButton  = document.getElementById('close-about') as HTMLButtonElement | null;

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
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

function setStartLoadingState(loading: boolean, error = false): void {
  isStarting = loading;
  if (startButton) {
    startButton.disabled = loading;
    startButton.textContent = loading ? 'Loading…' : 'Play Game';
  }
  if (error && startButton) startButton.textContent = 'Failed to load — retry?';
}

async function startGame(): Promise<void> {
  if (isStarting) return;
  if (!gameController) {
    setStartLoadingState(true);
    try {
      const { createGame } = await getGameModule();
      gameController = createGame({ bodyColor: selectedBodyColor, headColor: selectedHeadColor });
    } catch {
      setStartLoadingState(false, true);
      return;
    }
  }
  // Stop background animation to save resources while playing
  stopBgAnim?.();
  stopBgAnim = null;
  startScreen?.classList.add('hidden');
  gameShell?.classList.remove('hidden');
}

// Color swatch picker
document.getElementById('color-swatches')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.color-swatch');
  if (!btn) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  selectedBodyColor = parseInt((btn.dataset.body ?? 'e74c3c').replace('#', ''), 16);
  selectedHeadColor = parseInt((btn.dataset.head ?? 'ff6b6b').replace('#', ''), 16);
  // Reflect chosen color on the preview dot in the swatch
});

startButton?.addEventListener('click', () => { void startGame(); });
startAboutButton?.addEventListener('click', openAbout);
aboutButton?.addEventListener('click', openAbout);
closeAboutButton?.addEventListener('click', closeAbout);
aboutPanel?.addEventListener('click', (event) => {
  if (event.target === aboutPanel) closeAbout();
});

// Retry button → ask the Phaser scene to restart
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

// Start the animated canvas background
const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
if (bgCanvas) stopBgAnim = startBgAnimation(bgCanvas);

setVersionText();
