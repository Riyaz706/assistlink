/**
 * Playwright E2E config for AssistLink web build.
 * Start app with: cd frontend && npm run web (expo start --web)
 * baseURL = web app URL (e.g. http://localhost:8081). API URL is set via EXPO_PUBLIC_API_BASE_URL in the app (see docs/NETWORK_RULES.md).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run web --prefix frontend',
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  timeout: 30000,
  expect: { timeout: 10000 },
});
