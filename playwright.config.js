import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
