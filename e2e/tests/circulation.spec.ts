import { test, expect, type Page } from '@playwright/test'

// Full E2E suite against the local dev stack. Demo users (seeded by global-setup):
//   admin@demo.test  / password123  (library_admin)
//   reader@demo.test / password123  (library_reader)

async function login(page: Page, email: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()
}

test.describe('Auth', () => {
  test('login page renders without the auth-client crash (regression)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByText('Library Access')).toBeVisible()
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0)
    await expect(page.getByText(/Invalid base URL/i)).toHaveCount(0)
  })

  test('invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('reader@demo.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('unauthenticated visit redirects to login', async ({ page }) => {
    await page.goto('/my-books', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('reader does not see admin nav links', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await expect(page.getByRole('link', { name: 'Catalog' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Overdue' })).toHaveCount(0)
  })
})

test.describe('Circulation (reader)', () => {
  test('log in, borrow from catalog, see in My Books, and return', async ({ page }) => {
    await login(page, 'reader@demo.test')

    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()

    const borrowBtn = page.getByRole('button', { name: 'Borrow' }).first()
    await expect(borrowBtn).toBeEnabled()
    await borrowBtn.click()

    await page.getByRole('link', { name: 'My Books' }).first().click()
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()

    const returnBtn = page.getByRole('button', { name: 'Return' }).first()
    await expect(returnBtn).toBeVisible()
    await returnBtn.click()
    await expect(page.getByText('Returned. Thanks!')).toBeVisible()
  })

  test('scan-to-borrow by typing an ISBN', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await page.getByRole('link', { name: 'Scan' }).first().click()
    await expect(page.getByRole('heading', { name: 'Scan to Borrow' })).toBeVisible()

    await page.getByLabel('ISBN').fill('9780132350884') // Clean Code (seeded)
    await page.getByRole('button', { name: 'Borrow' }).click()

    // Either success (if available) or a friendly error (if already borrowed).
    const ok = page.getByTestId('scan-success')
    const err = page.getByTestId('scan-error')
    await expect(ok.or(err)).toBeVisible()

    // Clean up: if borrowed, return it so re-runs stay deterministic.
    if (await ok.isVisible()) {
      await page.getByRole('link', { name: 'My Books' }).first().click()
      const returnBtn = page.getByRole('button', { name: 'Return' }).first()
      if (await returnBtn.isVisible()) await returnBtn.click()
    }
  })
})

test.describe('Admin', () => {
  test('admin sees admin nav and can open Settings', async ({ page }) => {
    await login(page, 'admin@demo.test')
    await page.getByRole('link', { name: 'Settings' }).first().click()
    await expect(page.getByRole('heading', { name: 'Library Settings' })).toBeVisible()
    await expect(page.getByLabel('Library name')).toBeVisible()
  })

  test('admin can view the Overdue page', async ({ page }) => {
    await login(page, 'admin@demo.test')
    await page.getByRole('link', { name: 'Overdue' }).first().click()
    await expect(page.getByRole('heading', { name: 'Overdue Books' })).toBeVisible()
  })

  test('admin can view the Feedback page', async ({ page }) => {
    await login(page, 'admin@demo.test')
    await page.getByRole('link', { name: 'Feedback' }).first().click()
    await expect(page.getByRole('heading', { name: 'User Feedback' })).toBeVisible()
  })

  test('admin can add a book and see it in the catalog', async ({ page }) => {
    await login(page, 'admin@demo.test')
    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await page.getByRole('link', { name: 'Add Book' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Book' })).toBeVisible()

    const unique = `E2E Book ${Date.now()}`
    await page.getByLabel('ISBN').fill(`978${Date.now().toString().slice(-10)}`)
    await page.getByLabel('Title').fill(unique)
    await page.getByLabel('Author').fill('E2E Author')
    await page.getByRole('button', { name: 'Add Book' }).click()
    await expect(page.getByTestId('add-success')).toBeVisible()

    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await page.getByTestId('search-input').fill(unique)
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('link', { name: unique })).toBeVisible()
  })
})

test.describe('Feedback (any role)', () => {
  test('reader can submit feedback via the floating button', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await page.getByTestId('feedback-button').click()
    await expect(page.getByTestId('feedback-form')).toBeVisible()
    await page.getByLabel('Your feedback').fill('Please add more sci-fi books!')
    await page.getByTestId('feedback-form').getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(/Thanks for your feedback/i)).toBeVisible()
  })
})
