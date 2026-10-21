// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/lib/i18n'

// Mock the auth client so no real network calls are made.
vi.mock('@/lib/auth-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-client')>()
  return {
    ...actual,
    signUp: {
      email: vi.fn().mockResolvedValue({}),
    },
  }
})
// Prevent the router from actually navigating (no worker running).
vi.mock('@/lib/query', () => ({ queryClient: { clear: vi.fn(), invalidateQueries: vi.fn() } }))
vi.mock('@/lib/view-mode', () => ({ setReaderPreview: vi.fn(), useReaderPreview: () => false }))

import { SignUpPage } from './signup'

beforeAll(() => {
  // @ts-expect-error test shim
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

function renderSignup() {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider>
          <SignUpPage />
        </I18nProvider>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/signup'] }),
  })
  render(<RouterProvider router={router} />)
}

describe('SignUpPage', () => {
  it('renders email, password, confirm password fields and submit button', async () => {
    renderSignup()
    expect(await screen.findByTestId('signup-email')).toBeInTheDocument()
    expect(screen.getByTestId('signup-password')).toBeInTheDocument()
    expect(screen.getByTestId('signup-confirm')).toBeInTheDocument()
    expect(screen.getByTestId('signup-submit')).toBeInTheDocument()
  })

  it('shows a validation error when passwords do not match', async () => {
    renderSignup()
    await userEvent.type(await screen.findByTestId('signup-email'), 'user@example.com')
    await userEvent.type(screen.getByTestId('signup-password'), 'password123')
    await userEvent.type(screen.getByTestId('signup-confirm'), 'different456')
    await userEvent.click(screen.getByTestId('signup-submit'))
    await waitFor(() =>
      expect(screen.getByText(/don't match/i)).toBeInTheDocument()
    )
  })

  it('has a link to the login page', async () => {
    renderSignup()
    // The cross-link is inside a <Trans> — check the <Link> by href
    const link = await screen.findByRole('link', { name: /login|sign in|登录/i })
    expect(link).toHaveAttribute('href', '/login')
  })
})
