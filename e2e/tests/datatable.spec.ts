import { test, expect, type Page } from '@playwright/test'

// E2E for the upgraded DataTable (ADR 0008): sort + search wired end-to-end on a
// real admin list (Users). Behavior detail is covered by unit/component tests;
// here we only prove the wiring works in a real browser.

async function loginSuper(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill('super@demo.test')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
}

test.describe('DataTable behaviors (Users)', () => {
  test('column sort reorders rows', async ({ page }) => {
    await loginSuper(page)
    await page.getByRole('link', { name: 'Users' }).first().click()
    await expect(page.getByTestId('users-table')).toBeVisible()

    const firstBefore = await page.getByTestId(/^user-row-/).first().getAttribute('data-testid')
    // Click the Name sort header twice (asc then desc).
    await page.getByTestId('sort-name').click()
    const firstAsc = await page.getByTestId(/^user-row-/).first().getAttribute('data-testid')
    await page.getByTestId('sort-name').click()
    const firstDesc = await page.getByTestId(/^user-row-/).first().getAttribute('data-testid')

    // Sorting works if asc and desc put a different row first.
    expect(firstAsc).not.toBe(firstDesc)
    // ...and at least one direction differs from the initial order.
    expect(firstAsc !== firstBefore || firstDesc !== firstBefore).toBe(true)
  })

  test('toolbar search narrows the rows', async ({ page }) => {
    await loginSuper(page)
    await page.getByRole('link', { name: 'Users' }).first().click()
    await expect(page.getByTestId('users-table')).toBeVisible()

    const countBefore = await page.getByTestId(/^user-row-/).count()
    expect(countBefore).toBeGreaterThan(1)

    await page.getByTestId('users-search').fill('reader@demo.test')
    await expect(page.getByTestId(/^user-row-/)).toHaveCount(1)

    // Reset clears the filter and restores all rows.
    await page.getByTestId('users-reset').click()
    await expect(page.getByTestId(/^user-row-/)).toHaveCount(countBefore)
  })
})
