import { test, expect, type Page } from '@playwright/test'

// Core circulation flow: login (reader) → borrow a book → see it in My Books → return it.
// Runs against seeded demo data (reader@demo.test / password123).

class LibraryApp {
  constructor(private page: Page) {}

  async loginAsReader() {
    await this.page.goto('/login')
    await this.page.getByLabel('Email').fill('reader@demo.test')
    await this.page.getByLabel('Password').fill('password123')
    await this.page.getByRole('button', { name: 'Sign In' }).click()
    await this.page.waitForURL('**/books')
  }

  async borrowFirstAvailable() {
    const borrowBtn = this.page.getByRole('button', { name: 'Borrow' }).first()
    await borrowBtn.click()
  }

  async gotoMyBooks() {
    await this.page.getByRole('link', { name: 'My Books' }).click()
    await this.page.waitForURL('**/my-books')
  }
}

test.describe('Core circulation flow', () => {
  test('reader can log in, borrow, see in My Books, and return', async ({ page }) => {
    const app = new LibraryApp(page)

    await app.loginAsReader()
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()

    await app.borrowFirstAvailable()

    await app.gotoMyBooks()
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()
    const returnBtn = page.getByRole('button', { name: 'Return' }).first()
    await expect(returnBtn).toBeVisible()

    await returnBtn.click()
    // After returning, the book leaves My Books (empty state or one fewer item).
    await expect(page.getByText('No books currently borrowed.')).toBeVisible({ timeout: 10_000 })
  })

  test('invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('reader@demo.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })
})
