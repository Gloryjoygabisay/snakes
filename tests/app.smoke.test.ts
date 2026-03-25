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

    expect(document.getElementById('start-title')?.textContent).toBe('Snake Arena: Logic Survival');
    expect(document.getElementById('start-button')?.textContent).toBe('Start Game');
    // check p1-score exists in HTML
    expect(document.getElementById('p1-score')).not.toBeNull();
    expect(document.getElementById('challenge-overlay')).not.toBeNull();

    (document.getElementById('start-about-button') as HTMLButtonElement).click();
    expect(document.getElementById('about-panel')?.classList.contains('hidden')).toBe(false);

    (document.getElementById('close-about') as HTMLButtonElement).click();
    expect(document.getElementById('about-panel')?.classList.contains('hidden')).toBe(true);

    (document.getElementById('start-button') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(createGameMock).toHaveBeenCalledOnce();
    expect(document.getElementById('start-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('game-shell')?.classList.contains('hidden')).toBe(false);
  });
});
