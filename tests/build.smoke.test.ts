// @vitest-environment node

import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, mergeConfig, type UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import baseConfig from '../vite.config';

describe('production build smoke test', () => {
  it('builds the app and emits a loadable entrypoint', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'snakes-build-'));

    await build(
      mergeConfig(baseConfig as UserConfig, {
        logLevel: 'silent',
        build: {
          outDir,
          emptyOutDir: true
        }
      })
    );

    const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf8');
    const assetFiles = readdirSync(join(outDir, 'assets'));

    expect(indexHtml).toContain('<div id="app">');
    expect(indexHtml).toMatch(/assets\/.*\.js/);
    expect(assetFiles.some((file) => file.endsWith('.js'))).toBe(true);
    expect(assetFiles.some((file) => file.endsWith('.css'))).toBe(true);
  });
});
