// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n'
import { BooksTable, type AdminBookRow } from './BooksTable'

const rows: AdminBookRow[] = [
  { id: 'clean', title: 'Clean Code', author: 'Martin', isbn: '9780132350884', libraryId: 'lib-a', libraryName: 'Acme', quantity: 3, availableCount: 2 },
  { id: 'ddd', title: 'DDD', author: 'Evans', isbn: '9780321125217', libraryId: 'lib-b', libraryName: 'Globex', quantity: 1, availableCount: 0 },
]

function renderTable(props: Parameters<typeof BooksTable>[0]) {
  return render(
    <I18nProvider>
      <BooksTable {...props} />
    </I18nProvider>,
  )
}

describe('BooksTable', () => {
  it('renders one row per book with title/author/tenant/availability', async () => {
    renderTable({ rows, loading: false })
    expect(await screen.findByTestId('books-table')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^book-row-/)).toHaveLength(2)
    const row = screen.getByTestId('book-row-clean')
    expect(within(row).getByText('Clean Code')).toBeInTheDocument()
    expect(within(row).getByText('Acme')).toBeInTheDocument()
  })

  it('shows loading and empty states', async () => {
    const { rerender } = renderTable({ rows: [], loading: true })
    expect(await screen.findByTestId('books-loading')).toBeInTheDocument()
    rerender(
      <I18nProvider>
        <BooksTable rows={[]} loading={false} />
      </I18nProvider>,
    )
    expect(await screen.findByTestId('books-empty')).toBeInTheDocument()
  })
})
