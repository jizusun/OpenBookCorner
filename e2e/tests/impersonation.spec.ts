import { test, expect, type Page } from '@playwright/test'

// Impersonation E2E (ADR 0004 Part B). This is the ONE place the real Better
// Auth cookie-swap round-trip is exercised end to end — unit/integration tests
// cover the pure decision logic + audit side-effects, not the live session swap.
//
// Seeded by db/scripts/seed-users.sh: super@demo.test (super_admin) and a member
// 'Demo Reader' linked to reader@demo.test's login account (so the Members page
// shows an impersonation target).

async function loginSuper(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill('super@demo.test')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
}

test.describe('Impersonation (super admin)', () => {
  test('impersonate a reader → banner + reader view, then exit back to console', async ({ page }) => {
    await loginSuper(page)

    // System console → Users (global cross-tenant user directory).
    await page.getByRole('link', { name: 'Users' }).first().click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    // A reader row exposes the impersonate action to the super admin.
    const impersonate = page.getByRole('button', { name: 'Sign in as them' }).first()
    await expect(impersonate).toBeVisible()
    await impersonate.click()

    // Now impersonating: the persistent banner is shown with the exit control,
    // and we are in the reader's view (My Books).
    const banner = page.getByRole('status')
    await expect(banner).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to my account' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()

    // Exit impersonation → banner gone, back to the super-admin console (Overview).
    await page.getByRole('button', { name: 'Back to my account' }).click()
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  })

  test('library_admin does NOT see the impersonate action (least privilege)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('admin@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()

    await page.getByRole('link', { name: 'Readers' }).first().click()
    await expect(page.getByRole('heading', { name: 'Readers' })).toBeVisible()
    // No impersonation control for a non-super-admin.
    await expect(page.getByRole('button', { name: 'Sign in as them' })).toHaveCount(0)
  })
})
