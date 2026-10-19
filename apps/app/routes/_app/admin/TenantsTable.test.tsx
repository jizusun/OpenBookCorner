// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router'
import { I18nProvider } from '@/lib/i18n'
import { TenantsTable, type TenantRow } from './TenantsTable'

const rows: TenantRow[] = [
  { id: 'lib-a', name: 'Acme', slug: 'acme', isActive: true, bookCount: 34, userCount: 12 },
  { id: 'lib-b', name: 'Globex', slug: 'globex', isActive: false, bookCount: 20, userCount: 8 },
]

function renderTable(props: Parameters<typeof TenantsTable>[0]) {
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider>
        <TenantsTable {...props} />
      </I18nProvider>
    ),
  })
  const detail = createRoute({
    getParentRoute: () => rootRoute,
    path: '/admin/tenants/$libraryId',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([detail]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('TenantsTable', () => {
  it('renders one row per tenant as a quiet table', async () => {
    renderTable({ rows, loading: false })
    expect(await screen.findByTestId('tenant-table')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^tenant-row-/)).toHaveLength(2)
  })

  it('has NO per-row action buttons (actions live on the detail page)', async () => {
    renderTable({ rows, loading: false })
    const table = await screen.findByTestId('tenant-table')
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })

  it('drills into the detail page: tenant name links to /admin/tenants/$id', async () => {
    renderTable({ rows, loading: false })
    const row = await screen.findByTestId('tenant-row-lib-a')
    const link = within(row).getByRole('link', { name: 'Acme' })
    expect(link).toHaveAttribute('href', '/admin/tenants/lib-a')
  })

  it('shows slug and counts', async () => {
    renderTable({ rows, loading: false })
    const row = await screen.findByTestId('tenant-row-lib-a')
    expect(within(row).getByText('/t/acme')).toBeInTheDocument()
    expect(within(row).getByText('34')).toBeInTheDocument()
    expect(within(row).getByText('12')).toBeInTheDocument()
  })

  it('shows the loading state', async () => {
    renderTable({ rows: [], loading: true })
    expect(await screen.findByTestId('tenant-loading')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    renderTable({ rows: [], loading: false })
    expect(await screen.findByTestId('tenant-empty')).toBeInTheDocument()
  })
})
