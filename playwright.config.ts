import { defineConfig, devices } from '@playwright/test'

// E2E runs against the PRODUCTION BUILD served by `wrangler dev` (local), which has
// no per-request compile — warm requests are ~100ms, so the whole suite runs in well
// under a minute. (Dev-mode `vite dev` was too slow due to first-request compilation.)
const PORT = Number(process.env.E2E_PORT ?? 3200)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 25_000,
  expect: { timeout: 10_000 },
  // `list` streams each test's result line-by-line as it runs.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Build once, seed local D1 (same miniflare store wrangler dev uses), then serve the
  // built Worker with wrangler dev. Seeding uses wrangler (not cf) because the vite
  // plugin / wrangler dev share .wrangler/state; cf uses a different local store.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: [
          ...(process.env.E2E_SKIP_BUILD ? [] : ['pnpm run build']),
          'pnpm exec wrangler d1 migrations apply openbookcorner --local',
          'pnpm exec tsx scripts/seed.ts > .e2e-seed.sql',
          'pnpm exec wrangler d1 execute openbookcorner --local --file .e2e-seed.sql || true',
          `pnpm exec wrangler dev --local --port ${PORT}`,
        ].join(' && '),
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
