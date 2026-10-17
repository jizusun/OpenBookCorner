import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

async function login(page: Page, email: string, landingHeading = 'My Books') {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: landingHeading })).toBeVisible()
}

// A tiny committed .xls fixture with the 6 番薯 sheets (2 books, 2 members incl a
// placeholder, 1 active loan, 1 review, 1 purchase request).
const FIXTURE = fileURLToPath(new URL('./fixtures/fanshu-sample.xls', import.meta.url))

test.describe('番薯 import (tenant admin)', () => {
  test('reader cannot access the import page', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await page.goto('/admin/import', { waitUntil: 'domcontentloaded' })
    // redirected away from the admin-only page
    await expect(page).toHaveURL(/\/books|\/my-books|\/login/)
  })

  test('admin uploads an .xls, previews counts, then imports', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
    await page.goto('/admin/import', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /Import/i })).toBeVisible()

    // Upload the fixture workbook.
    await page.getByTestId('import-file').setInputFiles(FIXTURE)

    // Preview appears with parsed counts (books/members/loans).
    const preview = page.getByTestId('import-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText(/2\s*books/i)
    await expect(preview).toContainText(/2\s*members/i)

    // Commit the import.
    await page.getByRole('button', { name: /^Import$/ }).click()
    await expect(page.getByTestId('import-result')).toBeVisible()
    await expect(page.getByTestId('import-result')).toContainText(/imported/i)

    // The imported books show up in the catalog.
    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await page.getByTestId('search-input').fill('FanshuSample')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText(/FanshuSample Book 1/)).toBeVisible()
  })
})
