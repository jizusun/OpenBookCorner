import { test, expect, type Page } from '@playwright/test'

// E2E for the /switch/:libraryId route that auto-switches the active library.
// Use case: scan a QR code / open a shared link → land in the right library context.

async function signIn(page: Page, email: string, password = 'password123') {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill(password)
  await page.getByTestId('signin-submit').click()
}

test.describe('/switch/:libraryId route (auto-switch library)', () => {
  test('navigating to /switch/<libraryId> switches to that library for a member', async ({ page }) => {
    await signIn(page, 'admin@demo.test')
    await page.waitForURL(/books/, { timeout: 15000 })

    // Create a second library
    const libBId = await page.evaluate(async () => {
      const r = await fetch('/api/membership/create-library', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Switch Test Library', emailDomains: [] }),
      })
      return ((await r.json()) as { id: string }).id
    })
    expect(libBId).toBeTruthy()

    // Switch back to Acme so we can test the switch
    await page.evaluate(async () => {
      await fetch('/api/membership/switch', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId: 'lib-demo-001' }),
      })
    })

    // Navigate to /switch/<libBId> — should switch + land on /books
    await page.goto(`/switch/${libBId}`, { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/books$/, { timeout: 10000 })

    // The library switcher should now show the new library
    const switcher = page.getByTestId('library-switcher')
    await expect(switcher).toBeVisible()
    await expect(switcher).toContainText('Switch Test Library', { timeout: 8000 })
  })

  test('/switch/<id> for a non-member redirects to /books (graceful degradation)', async ({ page }) => {
    await signIn(page, 'reader@demo.test')
    await page.waitForURL(/my-books/, { timeout: 15000 })

    // Navigate with a library the reader doesn't belong to
    await page.goto('/switch/nonexistent-library-id', { waitUntil: 'networkidle' })

    // Should land on /books in the original library (no crash)
    await expect(page).toHaveURL(/\/books$/, { timeout: 8000 })
  })
})
