// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/lib/i18n'
import { DataTable, type Column, type FacetedFilter } from './DataTable'

interface Row {
  id: string
  name: string
  n: number
  role: string
}

const rows: Row[] = [
  { id: 'a', name: 'Charlie', n: 3, role: 'reader' },
  { id: 'b', name: 'alice', n: 1, role: 'admin' },
  { id: 'c', name: 'Bob', n: 2, role: 'reader' },
]

beforeAll(() => {
  // Radix popover/command/select use these in jsdom.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((q: string) => ({
      matches: false, media: q,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  )
  // jsdom lacks these APIs Radix relies on
  // @ts-expect-error test shim
  Element.prototype.scrollIntoView = vi.fn()
  // @ts-expect-error test shim
  Element.prototype.hasPointerCapture = vi.fn()
  // @ts-expect-error test shim
  Element.prototype.setPointerCapture = vi.fn()
  // @ts-expect-error test shim
  Element.prototype.releasePointerCapture = vi.fn()
  // jsdom lacks ResizeObserver (used by cmdk/popover)
  // @ts-expect-error test shim
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

const baseColumns: Column<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { id: 'n', header: 'Count', cell: (r) => r.n, muted: true, sortable: true, sortValue: (r) => r.n },
  { id: 'role', header: 'Role', cell: (r) => r.role },
]

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <I18nProvider>
      <DataTable<Row>
        rows={rows}
        loading={false}
        columns={baseColumns}
        rowKey={(r) => r.id}
        rowTestId={(r) => `row-${r.id}`}
        testId="t"
        empty={{ icon: '∅', title: 'No rows' }}
        {...props}
      />
    </I18nProvider>,
  )
}

function rowOrder() {
  return screen.getAllByTestId(/^row-/).map((el) => el.getAttribute('data-testid'))
}

describe('DataTable (backward compatible)', () => {
  it('renders headers, one row per item, and cell values', () => {
    renderTable()
    expect(screen.getByTestId('t-table')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(3)
    expect(within(screen.getByTestId('row-a')).getByText('Charlie')).toBeInTheDocument()
    cleanup()
  })

  it('shows loading state', () => {
    renderTable({ loading: true, rows: [] })
    expect(screen.getByTestId('t-loading')).toBeInTheDocument()
    cleanup()
  })

  it('shows empty state', () => {
    renderTable({ loading: false, rows: [] })
    expect(screen.getByTestId('t-empty')).toBeInTheDocument()
    cleanup()
  })
})

describe('DataTable sorting', () => {
  it('sorts ascending then descending on a sortable header click', async () => {
    renderTable()
    const sortName = screen.getByTestId('sort-name')
    await userEvent.click(sortName) // asc: alice, Bob, Charlie
    expect(rowOrder()).toEqual(['row-b', 'row-c', 'row-a'])
    await userEvent.click(sortName) // desc
    expect(rowOrder()).toEqual(['row-a', 'row-c', 'row-b'])
    cleanup()
  })

  it('does not render a sort control for non-sortable columns', () => {
    renderTable()
    expect(screen.queryByTestId('sort-role')).toBeNull()
    cleanup()
  })
})

describe('DataTable search', () => {
  it('filters rows by the toolbar search (and shows empty when none match)', async () => {
    renderTable({ toolbar: { search: { keys: [(r) => r.name, (r) => r.role], placeholder: 'Search' } } })
    const box = screen.getByTestId('t-search')
    await userEvent.type(box, 'bo')
    expect(rowOrder()).toEqual(['row-c']) // Bob
    await userEvent.clear(box)
    await userEvent.type(box, 'zzz')
    expect(screen.getByTestId('t-empty')).toBeInTheDocument()
    cleanup()
  })
})

describe('DataTable faceted filter', () => {
  const roleFacet: FacetedFilter<Row> = {
    columnId: 'role',
    label: 'Role',
    value: (r) => r.role,
    options: [
      { value: 'reader', label: 'Reader' },
      { value: 'admin', label: 'Admin' },
    ],
  }

  it('filters to the selected facet value', async () => {
    renderTable({ toolbar: { faceted: [roleFacet] } })
    await userEvent.click(screen.getByTestId('t-facet-role'))
    await userEvent.click(await screen.findByTestId('t-facet-role-opt-admin'))
    expect(rowOrder()).toEqual(['row-b']) // only the admin
    cleanup()
  })

  it('reset clears an active facet', async () => {
    renderTable({ toolbar: { faceted: [roleFacet] } })
    await userEvent.click(screen.getByTestId('t-facet-role'))
    await userEvent.click(await screen.findByTestId('t-facet-role-opt-admin'))
    expect(rowOrder()).toEqual(['row-b'])
    await userEvent.click(screen.getByTestId('t-reset'))
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(3)
    cleanup()
  })
})

describe('DataTable column visibility', () => {
  it('hides a column from the View menu', async () => {
    renderTable({ enableColumnVisibility: true })
    expect(screen.getByText('Count')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('t-view-options'))
    await userEvent.click(await screen.findByTestId('t-toggle-n'))
    expect(screen.queryByText('Count')).toBeNull()
    cleanup()
  })
})

describe('DataTable pagination', () => {
  const many: Row[] = Array.from({ length: 5 }, (_, i) => ({
    id: String(i), name: `u${i}`, n: i, role: 'reader',
  }))
  it('paginates with a page size and next/prev', async () => {
    renderTable({ rows: many, enablePagination: true, pageSize: 2 })
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(2)
    expect(screen.getByTestId('t-page-indicator')).toHaveTextContent('1')
    await userEvent.click(screen.getByTestId('t-next'))
    expect(screen.getByTestId('t-page-indicator')).toHaveTextContent('2')
    cleanup()
  })
})

describe('DataTable row selection + bulk', () => {
  it('selects a row and fires a bulk action with the selection', async () => {
    const onBulk = vi.fn()
    renderTable({
      enableRowSelection: true,
      bulkActions: [{ key: 'del', label: 'Delete', onClick: onBulk }],
    })
    await userEvent.click(screen.getByTestId('t-select-a'))
    expect(screen.getByTestId('t-bulk-bar')).toBeInTheDocument()
    expect(screen.getByTestId('t-bulk-count')).toHaveTextContent('1')
    await userEvent.click(screen.getByTestId('t-bulk-del'))
    expect(onBulk).toHaveBeenCalledTimes(1)
    expect(onBulk.mock.calls[0]![0].map((r: Row) => r.id)).toEqual(['a'])
    cleanup()
  })
})
