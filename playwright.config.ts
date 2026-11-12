import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs the real API (NODE_ENV=test, its own database, in-memory SMS) and
 * the real Vite app, on ports that don't clash with `npm run dev`.
 */
const API_PORT = 3111;
const WEB_PORT = 5174;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://localhost:5432/gogz_e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // tests share one database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/prepare-db.ts && npm run start -w @gogz/api',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL,
        APP_ORIGIN: `http://localhost:${WEB_PORT}`,
        LOGIN_RATE_LIMIT: '1000',
      },
    },
    {
      command: 'npm run dev -w @gogz/web',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      env: { WEB_PORT: String(WEB_PORT), API_PORT: String(API_PORT) },
    },
  ],
});
