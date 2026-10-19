import { test, expect, type Page } from '@playwright/test'

// Tenant onboarding E2E (方案 A). The ONLY layer that proves the real password
// hash + the newly-created user can actually sign in.

async function login(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).first().click()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

test.describe('Tenant onboarding', () => {
  test('super admin adds a tenant admin, who can then sign in', async ({ page }) => {
    const email = `admin+${Date.now()}@acme.test`
    const pw = 'password1234'

    await login(page, 'super@demo.test', 'password123')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    // Tenants → open Acme detail → Add admin.
    await page.getByRole('link', { name: 'Tenants' }).first().click()
    await page.getByRole('link', { name: 'Acme Library' }).click()
    await expect(page.getByRole('heading', { name: 'Acme Library' })).toBeVisible()
    await page.getByTestId('add-admin-open').click()
    await expect(page.getByTestId('add-user-dialog')).toBeVisible()
    await page.getByTestId('add-user-email').fill(email)
    await page.getByTestId('add-user-name').fill('New Admin')
    await page.getByTestId('add-user-password').fill(pw)
    await page.getByTestId('add-user-submit').click()
    await expect(page.getByText('Admin added.')).toBeVisible()

    // The new admin can sign in and lands on the admin surface (catalog).
    await logout(page)
    await login(page, email, pw)
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
  })

  test('library admin adds a reader, who can then sign in', async ({ page }) => {
    const email = `reader+${Date.now()}@acme.test`
    const pw = 'password1234'

    await login(page, 'admin@demo.test', 'password123')
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()

    await page.getByRole('link', { name: 'Members' }).first().click()
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()
    await page.getByTestId('add-member-open').click()
    await expect(page.getByTestId('add-user-dialog')).toBeVisible()
    await page.getByTestId('add-user-email').fill(email)
    await page.getByTestId('add-user-name').fill('New Reader')
    await page.getByTestId('add-user-password').fill(pw)
    await page.getByTestId('add-user-submit').click()
    await expect(page.getByText('Member added.')).toBeVisible()

    // The new reader can sign in and lands on My Books.
    await logout(page)
    await login(page, email, pw)
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()
  })
})
