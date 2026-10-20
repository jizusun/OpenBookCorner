// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'
import { DataTable, type Column } from './DataTable'

interface Row {
  id: string
  name: string
  n: number
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha', n: 1 },
  { id: 'b', name: 'Beta', n: 2 },
]

const columns: Column<Row>[] = [
  { header: 'Name', cell: (r) => r.name },
  { header: 'Count', cell: (r) => r.n, muted: true },
]

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <I18nProvider>
      <DataTable<Row>
        rows={rows}
        loading={false}
        columns={columns}
        rowKey={(r) => r.id}
        rowTestId={(r) => `row-${r.id}`}
        testId="t"
        empty={{ icon: '∅', title: 'No rows' }}
        {...props}
      />
    </I18nProvider>,
  )
}

describe('DataTable', () => {
  it('renders headers, one row per item, and cell values', () => {
    renderTable()
    expect(screen.getByTestId('t-table')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(2)
    expect(within(screen.getByTestId('row-a')).getByText('Alpha')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderTable({ loading: true, rows: [] })
    expect(screen.getByTestId('t-loading')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    renderTable({ loading: false, rows: [] })
    expect(screen.getByTestId('t-empty')).toBeInTheDocument()
    expect(screen.getByText('No rows')).toBeInTheDocument()
  })
})
