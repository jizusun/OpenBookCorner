import { test, expect, type Page } from '@playwright/test'

// Full E2E suite against the local dev stack. Demo users (seeded by global-setup):
//   admin@demo.test  / password123  (library_admin)
//   reader@demo.test / password123  (library_reader)

async function login(page: Page, email: string, landingHeading = 'My Books') {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('heading', { name: landingHeading })).toBeVisible()
}

// --- contrast helpers (WCAG) ---
// Resolve any CSS color string (oklch, rgb, hex…) to sRGB via the browser, then
// compute WCAG contrast. Done in-page so oklch() is handled by the engine.
async function contrastOf(
  locator: import('@playwright/test').Locator,
): Promise<number> {
  return locator.evaluate((el) => {
    function toRgb(input: string): [number, number, number] {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 1
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = '#000'
      ctx.fillStyle = input
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b]
    }
    function lum([r, g, b]: [number, number, number]): number {
      const a = [r, g, b].map((v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
    }
    const s = getComputedStyle(el)
    const l1 = lum(toRgb(s.color))
    const l2 = lum(toRgb(s.backgroundColor))
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (hi + 0.05) / (lo + 0.05)
  })
}

test.describe('Theme (primary contrast — regression)', () => {
  // Regression: button-styled links showed blue text on a blue bg because an
  // unlayered `a { color }` rule beat the Tailwind text-primary-foreground
  // utility. Assert readable contrast on both a <button> and a button-styled <a>.
  test('primary Sign In button has readable text (WCAG AA)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const btn = page.getByRole('button', { name: 'Sign In' })
    await expect(btn).toBeVisible()
    expect(await contrastOf(btn)).toBeGreaterThanOrEqual(4.5)
  })

  test('button-styled links (Scan to borrow) have readable text', async ({ page }) => {
    await login(page, 'reader@demo.test')
    const link = page.getByTestId('scan-to-borrow')
    await expect(link).toBeVisible()
    expect(await contrastOf(link)).toBeGreaterThanOrEqual(4.5)
  })
})

test.describe('App shell', () => {
  // Instant inline loader (index.html) must be in the first HTML so slow
  // connections see something immediately, and React must replace it on mount.
  test('serves an instant loader in the initial HTML', async ({ request }) => {
    const res = await request.get('/')
    const html = await res.text()
    expect(html).toContain('id="app-loader"')
    expect(html).toContain('obc-spinner')
  })

  test('loader is removed once the app mounts', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.locator('#app-loader')).toHaveCount(0)
  })
})

test.describe('Auth', () => {
  test('login page renders without the auth-client crash (regression)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0)
    await expect(page.getByText(/Invalid base URL/i)).toHaveCount(0)
  })

  test('invalid credentials are rejected', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('reader@demo.test')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/doesn.t match|Invalid email or password/i)).toBeVisible()
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
    await expect(page.getByText(/Returned\b/i)).toBeVisible()
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
  test('admin has no My Books / Scan nav and lands on the catalog', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('admin@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    // Admin default landing is the catalog, not My Books.
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My Books' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Scan' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible()
  })

  test('admin cannot borrow in Admin view (no Borrow button)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('admin@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Borrow' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Add Book' }).first()).toBeVisible()
  })

  test('admin can switch to Reader view, gets My Books + can borrow', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
    // Switch Admin -> Reader view.
    await page.getByTestId('view-switch').click()
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'My Books' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Scan' }).first()).toBeVisible()
    // In Reader view the admin can borrow from the catalog.
    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
    const borrowBtn = page.getByRole('button', { name: 'Borrow' }).first()
    await expect(borrowBtn).toBeVisible()
    if (await borrowBtn.isEnabled()) {
      await borrowBtn.click()
      await page.getByRole('link', { name: 'My Books' }).first().click()
      const ret = page.getByRole('button', { name: 'Return' }).first()
      if (await ret.isVisible()) await ret.click()
    }
  })

  test('admin can open Settings', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
    await page.getByRole('link', { name: 'Settings' }).first().click()
    await expect(page.getByRole('heading', { name: 'Library Settings' })).toBeVisible()
    await expect(page.getByLabel('Library name')).toBeVisible()
  })

  test('admin can view the Overdue page', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
    await page.getByRole('link', { name: 'Overdue' }).first().click()
    await expect(page.getByRole('heading', { name: 'Overdue Books' })).toBeVisible()
  })

  test('admin can view the Feedback page', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
    await page.getByRole('link', { name: 'Feedback' }).first().click()
    await expect(page.getByRole('heading', { name: 'User Feedback' })).toBeVisible()
  })

  test('admin can add a book and see it in the catalog', async ({ page }) => {
    await login(page, 'admin@demo.test', 'Library Catalog')
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

  test('multi-copy book stays borrowable until the last copy (B3)', async ({ page }) => {
    // Admin adds a book with 2 copies.
    await login(page, 'admin@demo.test', 'Library Catalog')
    await page.getByRole('link', { name: 'Add Book' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Book' })).toBeVisible()

    const unique = `Multi Copy ${Date.now()}`
    await page.getByLabel('ISBN').fill(`978${Date.now().toString().slice(-10)}`)
    await page.getByLabel('Title').fill(unique)
    await page.getByLabel('Author').fill('E2E Author')
    await page.getByLabel(/Copies/i).fill('2')
    await page.getByRole('button', { name: 'Add Book' }).click()
    await expect(page.getByTestId('add-success')).toBeVisible()

    // Switch to Reader view to borrow (admin cannot borrow in Admin view).
    await page.getByTestId('view-switch').click() // Admin -> Reader
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()

    // Find the new 2-copy book in the catalog and open its detail.
    await page.getByRole('link', { name: 'Catalog' }).first().click()
    await page.getByTestId('search-input').fill(unique)
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('link', { name: unique }).click()

    try {
      // 2 of 2 available, Borrow enabled.
      await expect(page.getByText(/2 of 2/)).toBeVisible()
      let borrowBtn = page.getByRole('button', { name: 'Borrow' })
      await expect(borrowBtn).toBeEnabled()
      await borrowBtn.click()

      // After one borrow: 1 of 2, still borrowable.
      await expect(page.getByText(/1 of 2/)).toBeVisible()
      borrowBtn = page.getByRole('button', { name: 'Borrow' })
      await expect(borrowBtn).toBeEnabled()
      await borrowBtn.click()

      // Last copy gone: all copies borrowed, Borrow disabled.
      await expect(page.getByText(/All 2 copies borrowed/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Borrow' })).toBeDisabled()
    } finally {
      // Return every copy this test borrowed so the shared demo account's
      // borrow limit isn't exhausted across reruns (prepare-local.sh preserves
      // data + global-setup reuses the demo users). Handles partial failures.
      await page.getByRole('link', { name: 'My Books' }).first().click()
      for (let i = 0; i < 2; i++) {
        const returnBtn = page.getByRole('button', { name: 'Return' }).first()
        if (await returnBtn.isVisible().catch(() => false)) {
          await returnBtn.click().catch(() => {})
          await page.getByText(/Returned\b/i).waitFor({ state: 'visible' }).catch(() => {})
        }
      }
    }
  })
})

test.describe('Super admin (tenant management)', () => {
  test('lands in System view and can see the Tenants page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('super@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tenants' }).first()).toBeVisible()
    // The demo tenants are listed (two-tenant seed: Acme + Globex).
    await expect(page.getByText('Acme Library')).toBeVisible()
    await expect(page.getByText('Globex Library')).toBeVisible()
  })

  test('can create a new library (tenant)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('super@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()

    const unique = `Acme ${Date.now()}`
    await page.getByLabel('Library name').fill(unique)
    await page.getByLabel(/Email domains/i).fill(`@acme${Date.now()}.com`)
    await page.getByRole('button', { name: 'Create library' }).click()
    await expect(page.getByText('Library created.')).toBeVisible()
    await expect(page.getByText(unique)).toBeVisible()
  })

  test('can switch System -> Admin -> Reader views', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Email').fill('super@demo.test')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()

    await page.getByTestId('view-switch').click() // -> Admin
    await expect(page.getByRole('heading', { name: 'Library Catalog' })).toBeVisible()
    await page.getByTestId('view-switch').click() // -> Reader
    await expect(page.getByRole('heading', { name: 'My Books' })).toBeVisible()
  })
})

test.describe('Feedback (any role)', () => {
  test('reader can submit feedback via the floating button', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await page.getByTestId('feedback-button').click()
    await expect(page.getByTestId('feedback-form')).toBeVisible()

    // Reproduce the "cannot type in the modal" bug: type character-by-character
    // (pressSequentially), which re-renders the dialog on each keystroke. If the
    // modal steals focus back to the first field, the textarea loses characters.
    const textarea = page.getByLabel('Your feedback')
    await textarea.click()
    const msg = 'Please add more sci-fi books!'
    await textarea.pressSequentially(msg, { delay: 20 })

    // The full message must be retained, and focus must still be in the textarea.
    await expect(textarea).toHaveValue(msg)
    await expect(textarea).toBeFocused()

    await page.getByTestId('feedback-form').getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(/Thanks for your feedback/i)).toBeVisible()
  })

  test('can change category then keep typing in the feedback modal', async ({ page }) => {
    await login(page, 'reader@demo.test')
    await page.getByTestId('feedback-button').click()
    await expect(page.getByTestId('feedback-form')).toBeVisible()

    await page.getByLabel('Type').selectOption('book_suggestion')
    const textarea = page.getByLabel('Your feedback')
    await textarea.click()
    await textarea.pressSequentially('The Three-Body Problem', { delay: 15 })
    await expect(textarea).toHaveValue('The Three-Body Problem')
    await page.getByTestId('feedback-form').getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(/Thanks for your feedback/i)).toBeVisible()
  })
})
