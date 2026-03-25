import { defineConfig, devices } from '@playwright/test';

const previewPort = 4173;

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

const baseURL = ensureTrailingSlash(
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${previewPort}`
);
const useLocalPreview = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: useLocalPreview
    ? {
        command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000
      }
    : undefined
});
