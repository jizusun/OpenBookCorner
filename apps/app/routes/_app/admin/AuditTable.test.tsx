// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'
import { AuditTable } from './AuditTable'
import type { AuditRow } from '@/lib/audit-format'

const rows: AuditRow[] = [
  {
    id: 'a1',
    actorUserId: 'super-1',
    onBehalfOfUserId: 'reader-7',
    libraryId: 'lib-a',
    action: 'impersonation.start',
    targetType: 'user',
    targetId: 'reader-7',
    metadata: null,
    createdAt: '2026-10-19T06:03:00.000Z',
  },
  {
    id: 'a2',
    actorUserId: 'super-1',
    onBehalfOfUserId: null,
    libraryId: null,
    action: 'tenant.create',
    targetType: 'library',
    targetId: 'lib-9',
    metadata: { slug: 'acme' },
    createdAt: '2026-10-19T05:50:00.000Z',
  },
]

function renderTable(props: Parameters<typeof AuditTable>[0]) {
  return render(
    <I18nProvider>
      <AuditTable {...props} />
    </I18nProvider>,
  )
}

describe('AuditTable', () => {
  it('renders a quiet table with one row per audit entry and the target shown', async () => {
    renderTable({ rows, loading: false })
    // Language-agnostic: assert structure (testids + data), not translated copy.
    const table = await screen.findByTestId('audit-table')
    expect(screen.getAllByTestId('audit-action')).toHaveLength(2)
    expect(within(table).getByText('lib-9')).toBeInTheDocument()
  })

  it('shows a loading skeleton while loading', () => {
    renderTable({ rows: [], loading: true })
    expect(screen.getByTestId('audit-loading')).toBeInTheDocument()
  })

  it('shows an empty state when there are no rows', () => {
    renderTable({ rows: [], loading: false })
    expect(screen.getByTestId('audit-empty')).toBeInTheDocument()
  })

  it('is read-only: no action buttons in any row (no cramped per-row controls)', async () => {
    renderTable({ rows, loading: false })
    const table = await screen.findByRole('table')
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })
})
