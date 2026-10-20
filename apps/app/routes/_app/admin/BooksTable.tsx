import { Trans } from '@lingui/react/macro'
import { DataTable, type Column } from '@/components/ui/DataTable'

export interface AdminBookRow {
  id: string
  title: string
  author: string
  isbn: string
  libraryId: string
  libraryName: string | null
  quantity: number
  availableCount: number
}

export interface BooksTableProps {
  rows: AdminBookRow[]
  loading: boolean
}

const columns: Column<AdminBookRow>[] = [
  { header: <Trans>Title</Trans>, cell: (b) => b.title },
  { header: <Trans>Author</Trans>, cell: (b) => b.author, muted: true },
  { header: <Trans>Tenant</Trans>, cell: (b) => b.libraryName ?? '—' },
  { header: <Trans>ISBN</Trans>, cell: (b) => b.isbn, muted: true },
  { header: <Trans>Available</Trans>, cell: (b) => `${b.availableCount}/${b.quantity}`, muted: true },
]

/** Quiet, read-only table of ALL books across tenants (super-admin console). */
export function BooksTable({ rows, loading }: BooksTableProps) {
  return (
    <DataTable<AdminBookRow>
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(b) => b.id}
      rowTestId={(b) => `book-row-${b.id}`}
      testId="books"
      skeletonRows={2}
      empty={{ icon: '📚', title: <Trans>No books found</Trans>, description: <Trans>Try a different search.</Trans> }}
    />
  )
}
