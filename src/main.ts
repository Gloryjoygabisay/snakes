import './styles.css';
import type { GameController } from './game';
import { loadGameModule } from './game-loader';
import packageJson from '../package.json';

let gameController: GameController | null = null;
let gameModulePromise: Promise<typeof import('./game')> | null = null;
let isStarting = false;
const appVersion = import.meta.env.VITE_APP_VERSION || packageJson.version;

const startScreen = document.getElementById('start-screen');
const gameShell = document.getElementById('game-shell');
const aboutPanel = document.getElementById('about-panel');
const startButton = document.getElementById('start-button') as HTMLButtonElement | null;
const startAboutButton = document.getElementById('start-about-button') as HTMLButtonElement | null;
const aboutButton = document.getElementById('about-button') as HTMLButtonElement | null;
const closeAboutButton = document.getElementById('close-about') as HTMLButtonElement | null;

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function openAbout(): void { aboutPanel?.classList.remove('hidden'); }
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
    startButton.textContent = loading ? 'Loading…' : 'Start Game';
  }
  if (error && startButton) startButton.textContent = 'Failed to load — retry?';
}

async function startGame(): Promise<void> {
  if (isStarting) return;
  if (!gameController) {
    setStartLoadingState(true);
    try {
      const { createGame } = await getGameModule();
      gameController = createGame();
    } catch {
      setStartLoadingState(false, true);
      return;
    }
  }
  startScreen?.classList.add('hidden');
  gameShell?.classList.remove('hidden');
}

startButton?.addEventListener('click', () => { void startGame(); });
startAboutButton?.addEventListener('click', openAbout);
aboutButton?.addEventListener('click', openAbout);
closeAboutButton?.addEventListener('click', closeAbout);
aboutPanel?.addEventListener('click', (event) => {
  if (event.target === aboutPanel) closeAbout();
});

// Direction buttons → dispatch event consumed by the Phaser scene
document.getElementById('dpad')?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-dir]');
  if (btn?.dataset.dir) {
    window.dispatchEvent(new CustomEvent('snake-dir', { detail: btn.dataset.dir }));
  }
});

// Retry button → ask the Phaser scene to restart
document.getElementById('retry-btn')?.addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('snake-retry'));
});

setVersionText();
