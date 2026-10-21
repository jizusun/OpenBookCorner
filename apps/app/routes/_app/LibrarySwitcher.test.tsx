// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createRootRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/lib/i18n'
import { SidebarProvider } from '@/components/ui/sidebar'
import { LibrarySwitcher } from './LibrarySwitcher'

beforeAll(() => {
  // @ts-expect-error test shim
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
})

type LibRow = { libraryId: string; name: string; role: string; active: boolean }

function renderSwitcher(libraries: LibRow[], brand = <span data-testid="brand">Brand</span>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  // Pre-seed the query cache so the switcher renders synchronously without fetching.
  qc.setQueryData(['membership', 'mine'], libraries)
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <SidebarProvider>
            <LibrarySwitcher brandFallback={brand} />
          </SidebarProvider>
        </I18nProvider>
      </QueryClientProvider>
    ),
  })
  render(<RouterProvider router={createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })} />)
  return qc
}

describe('LibrarySwitcher', () => {
  it('shows the brand fallback when the user has no libraries', async () => {
    renderSwitcher([])
    expect(await screen.findByTestId('brand')).toBeInTheDocument()
    expect(screen.queryByTestId('library-switcher')).toBeNull()
  })

  it('shows the active library name and admin role in the trigger', async () => {
    renderSwitcher([
      { libraryId: 'lib-a', name: 'Acme Library', role: 'library_admin', active: true },
    ])
    expect(await screen.findByTestId('library-switcher')).toBeInTheDocument()
    expect(screen.getByText('Acme Library')).toBeInTheDocument()
    // Role subtitle — may be split across elements by the icon+text badge
    expect(screen.getByTestId('library-switcher').textContent).toMatch(/admin|\u7ba1\u7406\u5458/i)
  })

  it('dropdown lists all libraries with their role badges', async () => {
    renderSwitcher([
      { libraryId: 'lib-a', name: 'Acme Library', role: 'library_admin', active: true },
      { libraryId: 'lib-b', name: 'Globex Library', role: 'library_reader', active: false },
    ])
    await userEvent.click(await screen.findByTestId('library-switcher'))
    const libA = await screen.findByTestId('switch-lib-lib-a')
    const libB = screen.getByTestId('switch-lib-lib-b')
    expect(libA).toBeInTheDocument()
    expect(libB).toBeInTheDocument()
    // Each list item contains the role badge text (may be split by icon)
    expect(libA.textContent).toMatch(/admin|\u7ba1\u7406\u5458/i)
    expect(libB.textContent).toMatch(/reader|读者|普通成员/i)
  })

  it('shows a Create or join link at the bottom of the dropdown', async () => {
    renderSwitcher([
      { libraryId: 'lib-a', name: 'My Lib', role: 'library_admin', active: true },
    ])
    await userEvent.click(await screen.findByTestId('library-switcher'))
    expect(await screen.findByTestId('switcher-create')).toBeInTheDocument()
  })
})
