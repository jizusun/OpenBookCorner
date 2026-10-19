// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'
import { UsersTable } from './UsersTable'
import type { AdminUserRow } from './UsersTable'

const impersonateUser = vi.fn(async () => ({}))
vi.mock('@/lib/auth-client', () => ({
  authClient: { admin: { impersonateUser: (a: { userId: string }) => impersonateUser(a) } },
}))

beforeEach(() => impersonateUser.mockClear())

const rows: AdminUserRow[] = [
  { id: 'alice', name: 'Alice', email: 'alice@acme.com', role: 'library_reader', libraryId: 'lib-a', libraryName: 'Acme' },
  { id: 'bob', name: 'Bob', email: 'bob@acme.com', role: 'library_admin', libraryId: 'lib-a', libraryName: 'Acme' },
  { id: 'root', name: 'Root', email: 'root@x.com', role: 'super_admin', libraryId: null, libraryName: null },
]

function renderTable(props: Parameters<typeof UsersTable>[0]) {
  return render(
    <I18nProvider>
      <UsersTable {...props} />
    </I18nProvider>,
  )
}

const base = {
  rows,
  loading: false,
  viewerRole: 'super_admin',
  viewerId: 'root',
  onImpersonated: () => {},
  clearCache: () => {},
}

describe('UsersTable', () => {
  it('renders one row per user with resolved library name + role', () => {
    renderTable(base)
    expect(screen.getAllByTestId(/^user-row-/)).toHaveLength(3)
    const aliceRow = screen.getByTestId('user-row-alice')
    expect(within(aliceRow).getByText('alice@acme.com')).toBeInTheDocument()
    expect(within(aliceRow).getByText('Acme')).toBeInTheDocument()
  })

  it('shows the impersonate action only for impersonable users (reader, not self, not admin)', async () => {
    renderTable(base)
    // alice (reader) → impersonable (await the async zh catalog)
    expect(
      await within(screen.getByTestId('user-row-alice')).findByRole('button', {
        name: '以其身份登录',
      }),
    ).toBeInTheDocument()
    // bob (admin) → not impersonable
    expect(
      within(screen.getByTestId('user-row-bob')).queryByRole('button', { name: '以其身份登录' }),
    ).toBeNull()
    // root (self) → not impersonable
    expect(
      within(screen.getByTestId('user-row-root')).queryByRole('button', { name: '以其身份登录' }),
    ).toBeNull()
  })

  it('hides all impersonate actions for a non-super-admin viewer', () => {
    renderTable({ ...base, viewerRole: 'library_admin', viewerId: 'bob' })
    expect(screen.queryAllByRole('button', { name: '以其身份登录' })).toHaveLength(0)
  })

  it('shows loading and empty states', () => {
    const { rerender } = renderTable({ ...base, rows: [], loading: true })
    expect(screen.getByTestId('users-loading')).toBeInTheDocument()
    rerender(
      <I18nProvider>
        <UsersTable {...base} rows={[]} loading={false} />
      </I18nProvider>,
    )
    expect(screen.getByTestId('users-empty')).toBeInTheDocument()
  })
})
