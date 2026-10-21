import { defineConfig } from '@playwright/test'

/**
 * E2E against the SINGLE consolidated Worker (app serves SPA assets AND runs the
 * Hono/tRPC + Better Auth backend). We build the SPA, prepare+seed a local D1,
 * then run one `wrangler dev --local` which serves everything on one origin.
 * global-setup creates the demo users through Better Auth before the suite runs.
 */
const PORT = 8787

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
    // The app defaults to Chinese and reads its locale from localStorage
    // ('obc-locale'). The E2E assertions are written against the English UI, so
    // seed the English locale for the test origin before the app boots. Keeps
    // the suite independent of the default-locale choice.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${PORT}`,
          localStorage: [{ name: 'obc-locale', value: 'en' }],
        },
      ],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Build SPA assets, migrate+seed local D1, then run the single worker. The
    // worker serves ./dist (assets) + /api/* + /covers/* from one origin.
    command:
      'bash -c "cd ../apps/app && bun run build && bash ../../e2e/prepare-local.sh && bunx wrangler dev --local --port 8787 --persist-to .wrangler/state-e2e --var ENVIRONMENT:development --var APP_ORIGIN:http://localhost:8787 --var BETTER_AUTH_SECRET:dev-e2e-secret-at-least-32-chars-long!!"',
    url: 'http://localhost:8787/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
