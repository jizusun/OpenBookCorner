// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { I18nProvider } from '@/lib/i18n'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar, type AppSidebarProps } from './AppSidebar'

// Spyable sidebar context: keep the real sidebar components/provider, but let
// each test control isMobile + observe setOpenMobile (the close-on-nav behavior).
const sidebarState = { isMobile: false, setOpenMobile: vi.fn() }
vi.mock('@/components/ui/sidebar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/sidebar')>()
  return { ...actual, useSidebar: () => ({ ...actual.useSidebar(), ...sidebarState }) }
})

beforeAll(() => {
  // shadcn sidebar uses matchMedia (use-mobile); jsdom needs a stub.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

beforeEach(() => {
  sidebarState.isMobile = false
  sidebarState.setOpenMobile = vi.fn()
})

function renderSidebar(props: Partial<AppSidebarProps> = {}) {
  const full: AppSidebarProps = {
    role: 'super_admin',
    readerPreview: false,
    ...props,
  }
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider>
          <SidebarProvider>
            <AppSidebar {...full} />
          </SidebarProvider>
        </I18nProvider>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return full
}

describe('AppSidebar', () => {
  it('super_admin shows the System console nav links', async () => {
    renderSidebar({ role: 'super_admin' })
    expect(await screen.findByTestId('nav-/admin/overview')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/admin/tenants')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/admin/users')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/admin/books')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/admin/audit')).toBeInTheDocument()
    // No library/reader pages for a super admin.
    expect(screen.queryByTestId('nav-/admin/members')).toBeNull()
  })

  it('library_admin shows the Library nav links', async () => {
    renderSidebar({ role: 'library_admin' })
    expect(await screen.findByTestId('nav-/admin/members')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/admin/overdue')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-/admin/overview')).toBeNull()
  })

  it('library_reader shows the Reader nav links', async () => {
    renderSidebar({ role: 'library_reader' })
    expect(await screen.findByTestId('nav-/my-books')).toBeInTheDocument()
    expect(screen.getByTestId('nav-/scan')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-/admin/overview')).toBeNull()
  })

  it('closes the mobile drawer after a nav link is tapped', async () => {
    sidebarState.isMobile = true
    sidebarState.setOpenMobile = vi.fn()
    renderSidebar({ role: 'library_reader' })
    await userEvent.click(await screen.findByTestId('nav-/scan'))
    expect(sidebarState.setOpenMobile).toHaveBeenCalledWith(false)
  })

  it('does NOT close the persistent rail on desktop', async () => {
    sidebarState.isMobile = false
    sidebarState.setOpenMobile = vi.fn()
    renderSidebar({ role: 'library_reader' })
    await userEvent.click(await screen.findByTestId('nav-/scan'))
    expect(sidebarState.setOpenMobile).not.toHaveBeenCalled()
  })
})
