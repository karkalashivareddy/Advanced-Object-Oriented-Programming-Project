import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** E2E runs against the repo's local Chrome/Edge channels; no browser download needed. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Keep clean runs honest: a retry must not hide flaky workspace behaviour.
  retries: 0,
  // Two workers keep the live API/login probe realistic without racing the
  // local seed backend with six simultaneous sessions.
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['list'],
    ['json', { outputFile: '../docs/evidence/PLAYWRIGHT_RESULTS.json' }],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'edge',
      use: { channel: 'msedge', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    // The dev server proxies /api to the running backend. Override for other ports.
    env: { VITE_API_PROXY_TARGET: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:18080' },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
