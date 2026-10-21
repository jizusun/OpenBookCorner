// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { I18nProvider } from '@/lib/i18n'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar, type AppSidebarProps } from './AppSidebar'

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

function renderSidebar(props: Partial<AppSidebarProps> = {}) {
  const full: AppSidebarProps = {
    role: 'super_admin',
    readerPreview: false,
    ...props,
  }
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider>
        <SidebarProvider>
          <AppSidebar {...full} />
        </SidebarProvider>
      </I18nProvider>
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
})
