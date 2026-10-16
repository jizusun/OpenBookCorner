import { test, expect, type Page } from '@playwright/test'

// Core circulation flow against seeded demo data (reader@demo.test / password123).
// Served by `wrangler dev` on the production build (fast warm requests ~100ms).
test.describe('Core circulation flow', () => {
  class LibraryApp {
    constructor(private page: Page) {}

    async loginAsReader() {
      await this.page.goto('/login', { waitUntil: 'domcontentloaded' })
      await expect(this.page.getByRole('button', { name: 'Sign In' })).toBeVisible()
      await this.page.getByLabel('Email').fill('reader@demo.test')
      await this.page.getByLabel('Password').fill('password123')
      await this.page.getByRole('button', { name: 'Sign In' }).click()
      await expect(this.page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
    }
  }

  test('reader can log in, borrow, see in My Books, and return', async ({ page }) => {
    const app = new LibraryApp(page)
    await app.loginAsReader()

    const borrowBtn = page.getByRole('button', { name: 'Borrow' }).first()
    await expect(borrowBtn).toBeEnabled()
    await borrowBtn.click()

    await page.getByRole('link', { name: 'My Books' }).click()
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()

    const returnBtn = page.getByRole('button', { name: 'Return' }).first()
    await expect(returnBtn).toBeVisible()
    await returnBtn.click()

    await expect(page.getByText("You haven't borrowed any books yet.")).toBeVisible()
  })

  test('invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await page.getByLabel('Email').fill('reader@demo.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })
})
