import { defineConfig } from '@playwright/test'

/**
 * E2E against a local dev stack:
 *  - API worker via `wrangler dev --local` (local D1) on :8787
 *  - SPA via `vite` on :5173, proxying /api -> :8787
 * A global setup migrates + seeds the local D1 and creates demo users through
 * Better Auth before the suite runs.
 */
const PORT = 5173

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      // API worker on local D1. prepare-local.sh migrates + seeds before dev starts.
      // --var overrides APP_ORIGIN so Better Auth trusts the SPA origin; a dev
      // BETTER_AUTH_SECRET avoids needing a secret store locally.
      command:
        'bash -c "cd ../apps/api && bash ../../e2e/prepare-local.sh && bunx wrangler dev --local --port 8787 --var APP_ORIGIN:http://localhost:5173 --var BETTER_AUTH_SECRET:dev-e2e-secret-at-least-32-chars-long!!"',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'bash -c "cd ../apps/app && API_ORIGIN=http://localhost:8787 bunx vite --port 5173 --strictPort"',
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
