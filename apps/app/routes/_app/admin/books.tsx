import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { BooksTable, type AdminBookRow } from './BooksTable'

// Client-side table (ADR 0008): fetch the full set and let the DataTable do
// search / sort / pagination in the browser.
const ALL = 200

export const Route = createFileRoute('/_app/admin/books')({
  pendingComponent: () => <ListPageSkeleton />,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: AdminBooksPage,
})

function AdminBooksPage() {
  const { t } = useLingui()
  const { data, isLoading } = useQuery(api.admin.books.queryOptions({ page: 1, limit: ALL }))
  const rows = (data?.items ?? []) as AdminBookRow[]
  const total = data?.total ?? rows.length
  const shown = rows.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Books</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>All books across every tenant (super admin).</Trans>
        </p>
      </div>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          <Trans>{total} books</Trans>
          {total > rows.length ? (
            <>
              {' · '}
              <span className="text-amber-600 dark:text-amber-500">
                <Trans>showing the first {shown} — refine upstream search to see the rest</Trans>
              </span>
            </>
          ) : null}
        </p>
      )}

      <BooksTable
        rows={rows}
        loading={isLoading}
        searchPlaceholder={t`Search by title, author or ISBN…`}
        searchAria={t`Search books`}
      />
    </div>
  )
}
