import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export interface Column<T> {
  /** Column header content (localize at the call site with <Trans> if needed). */
  header: ReactNode
  /** Cell renderer for a row. */
  cell: (row: T) => ReactNode
  /** Render the cell in muted/secondary text (for non-primary columns). */
  muted?: boolean
  /** Visually-hidden header (e.g. an actions column). */
  srHeader?: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  loading: boolean
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Per-row data-testid (e.g. `user-row-<id>`). */
  rowTestId?: (row: T) => string
  /** Prefix for the container/loading/empty testids: `<testId>-table|loading|empty`. */
  testId: string
  empty: { icon: string; title: ReactNode; description?: ReactNode }
  /** Skeleton rows while loading. */
  skeletonRows?: number
}

/**
 * The one quiet table used by every admin list page (Users, Books, Tenants,
 * Audit). Owns the container, header, row styling, loading + empty states;
 * callers supply only column definitions + row rendering. Keeps all list pages
 * visually identical and removes the repeated <table> scaffolding.
 */
export function DataTable<T>({
  rows,
  loading,
  columns,
  rowKey,
  rowTestId,
  testId,
  empty,
  skeletonRows = 3,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid={`${testId}-loading`}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div data-testid={`${testId}-empty`}>
        <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border" data-testid={`${testId}-table`}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {c.srHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-t hover:bg-accent/40"
              data-testid={rowTestId?.(row)}
            >
              {columns.map((c, i) => (
                <td key={i} className={`px-3 py-2${c.muted ? ' text-muted-foreground' : ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
