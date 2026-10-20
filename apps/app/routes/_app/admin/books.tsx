import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pager } from '@/components/ui/Pager'
import { BooksTable, type AdminBookRow } from './BooksTable'

const PAGE_SIZE = 50
const searchSchema = z.object({ q: z.string().optional() })

export const Route = createFileRoute('/_app/admin/books')({
  pendingComponent: () => <ListPageSkeleton />,
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: AdminBooksPage,
})

function AdminBooksPage() {
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useLingui()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(api.admin.books.queryOptions({ search: q, page, limit: PAGE_SIZE }))
  const rows = (data?.items ?? []) as AdminBookRow[]
  const total = data?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

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

      <SearchBar
        initial={q ?? ''}
        placeholder={t`Search by title, author or ISBN…`}
        ariaLabel={t`Search books`}
        data-testid="admin-book-search"
        onSearch={(term) => {
          setPage(1)
          navigate({ search: () => ({ q: term || undefined }) })
        }}
      />

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          <Trans>{total} books</Trans>
        </p>
      )}

      <BooksTable rows={rows} loading={isLoading} />

      <Pager
        page={page}
        hasMore={hasMore}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        data-testid="books-pager"
      />
    </div>
  )
}
