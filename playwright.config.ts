import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chrome-1280', use: { channel: 'chrome', viewport: { width: 1280, height: 900 } } },
    { name: 'chrome-360', use: { channel: 'chrome', viewport: { width: 360, height: 800 } } },
    { name: 'edge-1280', use: { channel: 'msedge', viewport: { width: 1280, height: 900 } } },
    { name: 'edge-360', use: { channel: 'msedge', viewport: { width: 360, height: 800 } } },
  ],
  webServer: { command: 'npm run demo', url: 'http://127.0.0.1:3000/api/health', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
