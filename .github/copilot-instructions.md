# Copilot Instructions

## Build and test commands

- `npm run dev` starts the Vite dev server.
- `npm run build` runs `tsc` and creates the production build in `dist/`.
- `npm run preview` serves the built app locally from `dist/`.
- `npm test` runs the full Vitest smoke suite.
- `npm run test:watch` runs Vitest in watch mode.
- Run a single test file with `npx vitest run tests/app.smoke.test.ts`.
- Run a single test by name with `npx vitest run --grep "renders the start screen"`.

## High-level architecture

The app has a split bootstrap flow across `index.html`, `src/main.ts`, `src/game-loader.ts`, and `src/game.ts`.

- `index.html` contains the full DOM shell for the start screen, About panel, in-game HUD, and stats.
- `src/main.ts` owns all non-Phaser UI state: start/about interactions, version labels, and the transition from the start screen into gameplay.
- `src/game-loader.ts` exists only to lazy-load the Phaser module so it is not downloaded until the player starts the game.
- `src/game.ts` owns the actual game runtime. It creates a single `SnakeScene`, handles grid movement, collision detection, food spawning, and score updates.

## Key conventions

- `src/main.ts` owns DOM elements outside Phaser. `src/game.ts` should not become the source of truth for the start screen or About modal.
- The game uses a fixed grid: 32 columns × 24 rows, each cell 20×20 pixels (640×480 canvas).
- Score and high score are tracked in memory; page reloads reset progress.
- Touch controls, keyboard movement, and responsive layout span `index.html`, `src/game.ts`, and `src/styles.css`. Changes in controls usually require coordinated updates across those files.
- TypeScript is strict with `noUnusedLocals`/`noUnusedParameters` enabled.
- Deployment uses `vite.config.ts` with `base: './'` for static hosting compatibility.
- `.github/workflows/deploy.yml` computes `VITE_APP_VERSION` during GitHub Pages builds.
