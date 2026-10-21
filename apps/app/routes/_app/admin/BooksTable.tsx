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
  searchPlaceholder?: string
  searchAria?: string
}

const columns: Column<AdminBookRow>[] = [
  { id: 'title', header: <Trans>Title</Trans>, cell: (b) => b.title, sortable: true, sortValue: (b) => b.title },
  { id: 'author', header: <Trans>Author</Trans>, cell: (b) => b.author, muted: true, sortable: true, sortValue: (b) => b.author },
  { id: 'tenant', header: <Trans>Tenant</Trans>, cell: (b) => b.libraryName ?? '—', sortable: true, sortValue: (b) => b.libraryName },
  { id: 'isbn', header: <Trans>ISBN</Trans>, cell: (b) => b.isbn, muted: true },
  {
    id: 'available',
    header: <Trans>Available</Trans>,
    cell: (b) => `${b.availableCount}/${b.quantity}`,
    muted: true,
    sortable: true,
    sortValue: (b) => b.availableCount,
  },
]

/** Quiet, read-only table of ALL books across tenants (super-admin console). */
export function BooksTable({ rows, loading, searchPlaceholder, searchAria }: BooksTableProps) {
  return (
    <DataTable<AdminBookRow>
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(b) => b.id}
      rowTestId={(b) => `book-row-${b.id}`}
      testId="books"
      skeletonRows={2}
      toolbar={{
        search: {
          keys: [(b) => b.title, (b) => b.author, (b) => b.isbn, (b) => b.libraryName],
          placeholder: searchPlaceholder,
          ariaLabel: searchAria,
        },
      }}
      enableColumnVisibility
      enablePagination
      pageSize={20}
      empty={{ icon: '📚', title: <Trans>No books found</Trans>, description: <Trans>Try a different search.</Trans> }}
    />
  )
}
