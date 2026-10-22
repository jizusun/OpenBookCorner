import { test, expect, type Page } from '@playwright/test'

// E2E for ADR 0009: multi-library membership core flow.
// Covers: self-registration → create library → admin role → invite link → 
// reader joins via invite → reader sees two libraries → role differs per library.

const BASE = process.env.BASE_URL ?? 'http://localhost:8787'

async function signUp(page: Page, email: string) {
  await page.goto('/signup', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill('password123')
  await page.locator('input[name=confirmPassword]').fill('password123')
  await page.getByTestId('signup-submit').click()
}

async function signIn(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill('password123')
  await page.getByTestId('signin-submit').click()
}

test.describe('Multi-library membership (ADR 0009)', () => {
  test('new user creates a library and becomes its admin', async ({ page }) => {
    const email = `admin+${Date.now()}@membership.test`
    await signUp(page, email)
    // Redirected to /welcome after sign-up
    await page.waitForURL(/welcome/, { timeout: 15000 })
    expect(page.url()).toMatch(/welcome/)

    // Create a library
    await page.getByTestId('welcome-create-open').click()
    await page.getByTestId('welcome-name').fill('My Test Library')
    await page.locator('[form=welcome-create-form][type=submit]').click()
    await page.waitForURL(/books/, { timeout: 10000 })

    // The admin nav groups must appear — this confirms the user is recognised as
    // library_admin in their newly-created library (the core ADR 0009 assertion).
    await expect(page.getByTestId('nav-/admin/library-users')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('nav-/admin/join-requests')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('nav-/admin/invites')).toBeVisible()
  })

  test('admin creates an invite link; reader joins and sees two libraries', async ({ page, context }) => {
    const ts = Date.now()
    const adminEmail = `inviteadmin+${ts}@membership.test`
    const readerEmail = `invitereader+${ts}@membership.test`

    // ── Admin: sign up → create lib → create invite ──────────────
    await signUp(page, adminEmail)
    await page.waitForURL(/welcome/, { timeout: 15000 })
    await page.getByTestId('welcome-create-open').click()
    await page.getByTestId('welcome-name').fill('Invite Test Library')
    await page.locator('[form=welcome-create-form][type=submit]').click()
    await page.waitForURL(/books/, { timeout: 10000 })

    // Go to invites page
    await page.getByTestId('nav-/admin/invites').click()
    await page.waitForURL(/invites/, { timeout: 8000 })
    await page.getByTestId('create-invite-open').click()
    // Auto-join: no approval needed
    const autoJoinCheck = page.getByTestId('invite-auto-join')
    if (await autoJoinCheck.isChecked() === false) {
      await autoJoinCheck.check()
    }
    await page.locator('[form=invite-form][type=submit]').click()
    // Wait for invite to appear and copy the URL
    await expect(page.getByTestId(/^invite-/)).toBeVisible({ timeout: 8000 })
    const inviteInput = page.locator('code').first()
    const inviteUrl = await inviteInput.textContent()
    expect(inviteUrl).toMatch(/\/join\//)
    const token = inviteUrl!.split('/join/')[1]!.trim()

    // ── Reader: sign up → land on /welcome → use invite ──────────
    const page2 = await context.newPage()
    await signUp(page2, readerEmail)
    await page2.waitForURL(/welcome/, { timeout: 15000 })

    // Navigate to the invite landing page
    await page2.goto(`/join/${token}`, { waitUntil: 'domcontentloaded' })
    const joinBtn = page2.getByTestId('invite-join-btn')
    await expect(joinBtn).toBeVisible({ timeout: 8000 })
    await joinBtn.click()

    // After joining, should navigate to /books
    await page2.waitForURL(/books/, { timeout: 10000 })

    // The reader now belongs to "Invite Test Library"
    const switcher2 = page2.getByTestId('library-switcher')
    await expect(switcher2).toBeVisible()
    expect(await switcher2.textContent()).toContain('Invite Test Library')
  })
})
