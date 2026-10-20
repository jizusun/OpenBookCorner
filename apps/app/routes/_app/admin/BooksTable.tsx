import { Trans } from '@lingui/react/macro'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

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

/** Quiet, read-only table of ALL books across tenants (super-admin console). */
export function BooksTable({ rows, loading }: BooksTableProps) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="books-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div data-testid="books-empty">
        <EmptyState icon="📚" title={<Trans>No books found</Trans>} description={<Trans>Try a different search.</Trans>} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border" data-testid="books-table">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium"><Trans>Title</Trans></th>
            <th className="px-3 py-2 font-medium"><Trans>Author</Trans></th>
            <th className="px-3 py-2 font-medium"><Trans>Tenant</Trans></th>
            <th className="px-3 py-2 font-medium"><Trans>ISBN</Trans></th>
            <th className="px-3 py-2 font-medium"><Trans>Available</Trans></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t hover:bg-accent/40" data-testid={`book-row-${b.id}`}>
              <td className="px-3 py-2 font-medium">{b.title}</td>
              <td className="px-3 py-2 text-muted-foreground">{b.author}</td>
              <td className="px-3 py-2">{b.libraryName ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{b.isbn}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {b.availableCount}/{b.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
