// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { I18nProvider } from '@/lib/i18n'
import { LoginHeader, Route } from './login'
import type { TenantBranding } from '@/lib/branding'

// The login route pulls branding from the public endpoint. We mock the helper so
// these stay pure component tests (no network, no Worker).
vi.mock('@/lib/branding', async () => {
  const actual = await vi.importActual<typeof import('@/lib/branding')>('@/lib/branding')
  return { ...actual, fetchBranding: vi.fn() }
})
import { fetchBranding } from '@/lib/branding'

const branding: TenantBranding = {
  name: 'Acme Library',
  logoUrl: 'https://cdn.example/acme-logo.png',
  brandColor: '#1e40af',
  loginWelcome: 'Welcome, Acme engineers!',
}

function renderHeader(b: TenantBranding | null) {
  return render(
    <I18nProvider>
      <LoginHeader branding={b} />
    </I18nProvider>,
  )
}

describe('LoginHeader (prop-driven branding)', () => {
  it('renders the tenant name, logo and welcome line when branding is provided', () => {
    renderHeader(branding)
    expect(screen.getByTestId('branded-name')).toHaveTextContent('Acme Library')
    const logo = screen.getByRole('img', { name: 'Acme Library' })
    expect(logo).toHaveAttribute('src', 'https://cdn.example/acme-logo.png')
    expect(screen.getByText('Welcome, Acme engineers!')).toBeInTheDocument()
  })

  it('falls back to the standard header when branding is null', () => {
    renderHeader(null)
    // Default locale is Chinese; "Welcome back" is "欢迎回来".
    expect(screen.getByText('欢迎回来')).toBeInTheDocument()
    expect(screen.queryByTestId('branded-name')).not.toBeInTheDocument()
  })

  it('omits the logo image when the tenant has no logoUrl', () => {
    renderHeader({ ...branding, logoUrl: null })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('branded-name')).toHaveTextContent('Acme Library')
  })
})

describe('LoginPage (branded vs standard, demo accounts)', () => {
  const LoginPage = Route.options.component as () => React.ReactElement

  // Render the file-route component inside a minimal memory router so
  // `useRouter()` resolves (TanStack testing pattern).
  function renderLogin() {
    const rootRoute = createRootRoute({
      component: () => (
        <I18nProvider>
          <LoginPage />
        </I18nProvider>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return render(<RouterProvider router={router as any} />)
  }

  beforeEach(() => {
    vi.mocked(fetchBranding).mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('hides the demo accounts and shows the tenant name on a branded host', async () => {
    vi.mocked(fetchBranding).mockResolvedValue(branding)
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('branded-name')).toBeInTheDocument())
    expect(screen.queryByTestId('demo-accounts')).not.toBeInTheDocument()
  })

  it('shows the demo accounts on the apex / unbranded host', async () => {
    vi.mocked(fetchBranding).mockResolvedValue(null)
    renderLogin()
    await waitFor(() => expect(screen.getByTestId('demo-accounts')).toBeInTheDocument())
    expect(screen.queryByTestId('branded-name')).not.toBeInTheDocument()
  })
})
