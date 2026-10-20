import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPageSkeleton } from '@/components/ui/skeleton'
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
  const [term, setTerm] = useState(q ?? '')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(api.admin.books.queryOptions({ search: q, page, limit: PAGE_SIZE }))
  const rows = (data?.items ?? []) as AdminBookRow[]
  const total = data?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    navigate({ search: () => ({ q: term.trim() || undefined }) })
  }

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

      <form onSubmit={submit} className="flex gap-2" data-testid="admin-book-search">
        <Input
          placeholder={t`Search by title, author or ISBN…`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t`Search books`}
        />
        <Button type="submit" variant="outline">
          <Trans>Search</Trans>
        </Button>
      </form>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          <Trans>{total} books</Trans>
        </p>
      )}

      <BooksTable rows={rows} loading={isLoading} />

      <div className="flex items-center justify-between text-sm">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="admin-book-prev">
          <Trans>Previous</Trans>
        </Button>
        <span className="text-muted-foreground"><Trans>Page {page}</Trans></span>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)} data-testid="admin-book-next">
          <Trans>Next</Trans>
        </Button>
      </div>
    </div>
  )
}
