import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const createGameMock = vi.fn();

vi.mock('../src/game-loader', () => ({
  loadGameModule: vi.fn(async () => ({
    createGame: createGameMock
  }))
}));

function loadHtmlShell(): void {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('Failed to load app shell from index.html');
  document.body.innerHTML = bodyMatch[1].replace(
    /<script type="module" src="\/src\/main\.ts"><\/script>/,
    ''
  );
}

describe('app bootstrap smoke test', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createGameMock.mockReturnValue({ destroy: vi.fn() });
    loadHtmlShell();
  });

  it('renders the start screen and wires core UI actions', async () => {
    await import('../src/main');

    expect(document.getElementById('start-title')?.textContent).toBe('Venom Arena');

    // Venom Arena uses mode cards → level cards to start the game
    expect(document.getElementById('mode-select')).not.toBeNull();
    expect(document.getElementById('level-cards')).not.toBeNull();

    // New survival UI elements exist
    expect(document.getElementById('lives-display')).not.toBeNull();
    expect(document.getElementById('survival-timer')).not.toBeNull();
    expect(document.getElementById('susie-bubble')).not.toBeNull();

    // About panel works
    (document.getElementById('start-about-button') as HTMLButtonElement).click();
    expect(document.getElementById('about-panel')?.classList.contains('hidden')).toBe(false);

    (document.getElementById('close-about') as HTMLButtonElement).click();
    expect(document.getElementById('about-panel')?.classList.contains('hidden')).toBe(true);

    // Clicking a mode card shows level screen
    const explorerCard = document.querySelector<HTMLElement>('.mode-card[data-mode="explorer"]');
    explorerCard?.click();
    expect(document.getElementById('level-screen')?.classList.contains('hidden')).toBe(false);

    // Clicking a level card starts the game
    const levelCard = document.querySelector<HTMLElement>('.level-select-card[data-level="1"]');
    levelCard?.click();
    await Promise.resolve();
    await Promise.resolve(); // extra tick for async startGame

    expect(createGameMock).toHaveBeenCalledOnce();
    expect(document.getElementById('start-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('game-shell')?.classList.contains('hidden')).toBe(false);
  });
});
