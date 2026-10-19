import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api'
import { BookCard } from '@/components/books/BookCard'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Trans, useLingui } from '@lingui/react/macro'
import { BookListSkeleton, ListPageSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useInfiniteList, LoadMoreSentinel } from '@/components/InfiniteList'
import { useReaderPreview } from '@/lib/view-mode'

const sortSchema = z.enum(['enteredAt', 'title', 'author', 'available', 'price'])
const availabilitySchema = z.enum(['all', 'available', 'borrowed'])

const searchSchema = z.object({
  q: z.string().optional(),
  sort: sortSchema.optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  category: z.string().optional(),
  shelf: z.string().optional(),
  avail: availabilitySchema.optional(),
})

export const Route = createFileRoute('/_app/books/')({
  pendingComponent: () => <ListPageSkeleton />,
  validateSearch: searchSchema,
  component: CatalogPage,
})

const PAGE_SIZE = 24
type Book = Awaited<ReturnType<typeof api.book.list.query>>['items'][number]

function CatalogPage() {
  const { q, sort, dir, category, shelf, avail } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const [term, setTerm] = useState(q ?? '')

  const { data: user } = useQuery(api.auth.me.queryOptions())
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'
  const readerPreview = useReaderPreview()
  const manageMode = isAdmin && !readerPreview

  const { data: facets } = useQuery(api.book.facets.queryOptions())

  // Server-side sort + filter, infinite scroll by page.
  const baseInput = {
    search: q,
    limit: PAGE_SIZE,
    sortBy: sort,
    sortDir: dir,
    category,
    shelf,
    availability: avail,
  }
  const infinite = useInfiniteList(['book.list.infinite', baseInput], (page) =>
    api.book.list.query({ ...baseInput, page }),
  )

  const items: Book[] = infinite.items
  const total = infinite.total

  const borrow = useMutation({
    ...api.borrowing.borrow.mutationOptions(),
    onSuccess: () => toast.success(t`Borrowed — see it in “My Books”.`),
    onError: (e) => toast.error(circulationErrorMessage(e)),
    onSettled: () => {
      void infinite.refetch()
      queryClient.invalidateQueries({ queryKey: api.borrowing.myBooks.queryKey() })
    },
  })

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const next = term.trim()
    navigate({ search: (prev) => ({ ...prev, q: next || undefined }) })
  }
  const setParam = (key: keyof typeof searchSchema.shape, value: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value || undefined }) })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold"><Trans>Library Catalog</Trans></h1>
        {manageMode && (
          <Link to="/books/add" className={buttonVariants({ size: 'sm' })}>
            <Trans>Add Book</Trans>
          </Link>
        )}
      </div>

      <form onSubmit={submitSearch} className="flex gap-2" data-testid="search-form">
        <Input
          placeholder={t`Search by title or author…`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          data-testid="search-input"
          aria-label={t`Search by title or author`}
        />
        <Button type="submit" variant="outline">
          <Trans>Search</Trans>
        </Button>
      </form>

      {/* Sort + filter controls */}
      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="catalog-controls">
        <label className="flex items-center gap-1">
          <span className="text-muted-foreground"><Trans>Sort</Trans></span>
          <select
            className="rounded-md border px-2 py-1"
            data-testid="sort-select"
            value={sort ?? 'enteredAt'}
            onChange={(e) => setParam('sort', e.target.value === 'enteredAt' ? undefined : e.target.value)}
          >
            <option value="enteredAt">{t`Date added`}</option>
            <option value="title">{t`Title`}</option>
            <option value="author">{t`Author`}</option>
            <option value="available">{t`Availability`}</option>
            <option value="price">{t`Price`}</option>
          </select>
        </label>
        <select
          className="rounded-md border px-2 py-1"
          data-testid="dir-select"
          value={dir ?? 'desc'}
          onChange={(e) => setParam('dir', e.target.value === 'desc' ? undefined : e.target.value)}
        >
          <option value="desc">{t`Descending`}</option>
          <option value="asc">{t`Ascending`}</option>
        </select>
        <select
          className="rounded-md border px-2 py-1"
          data-testid="availability-select"
          value={avail ?? 'all'}
          onChange={(e) => setParam('avail', e.target.value === 'all' ? undefined : e.target.value)}
        >
          <option value="all">{t`All`}</option>
          <option value="available">{t`Available`}</option>
          <option value="borrowed">{t`Borrowed`}</option>
        </select>
        {facets && facets.categories.length > 0 && (
          <select
            className="rounded-md border px-2 py-1"
            data-testid="category-select"
            value={category ?? ''}
            onChange={(e) => setParam('category', e.target.value || undefined)}
          >
            <option value="">{t`All categories`}</option>
            {facets.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {facets && facets.shelves.length > 0 && (
          <select
            className="rounded-md border px-2 py-1"
            data-testid="shelf-select"
            value={shelf ?? ''}
            onChange={(e) => setParam('shelf', e.target.value || undefined)}
          >
            <option value="">{t`All shelves`}</option>
            {facets.shelves.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {!infinite.isLoading && (
          <span className="text-xs text-muted-foreground" data-testid="result-count">
            {t`${total} books`}
          </span>
        )}
      </div>

      {infinite.isLoading && <BookListSkeleton />}

      {!infinite.isLoading && items.length === 0 && (
        <EmptyState
          data-testid="no-books"
          icon="📚"
          title={q ? t`No books match your search` : t`No books match the current filters`}
          description={manageMode ? t`Add a book or adjust the filters.` : t`Try adjusting the search or filters.`}
          action={
            manageMode ? (
              <Link to="/books/add" className={buttonVariants({ size: 'sm' })}>
                <Trans>Add Book</Trans>
              </Link>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-4">
        {items.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onBorrow={(id) => borrow.mutate({ bookId: id })}
            pending={borrow.isPending && borrow.variables?.bookId === book.id}
            canBorrow={!manageMode}
          />
        ))}
      </div>

      {/* Infinite-scroll sentinel + manual fallback (shared component) */}
      <LoadMoreSentinel
        hasNextPage={infinite.hasNextPage}
        isFetchingNextPage={infinite.isFetchingNextPage}
        fetchNextPage={() => infinite.fetchNextPage()}
      />
    </div>
  )
}
