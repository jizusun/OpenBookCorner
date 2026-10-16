import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { listBooks } from '@/server/functions/book'
import { borrowBook } from '@/server/functions/borrowing'
import { me } from '@/server/functions/auth'
import { BookCard } from '@/components/books/BookCard'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { Badge } from '@/components/ui/badge'
import { BookListSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
  available: z.boolean().optional(),
  subject: z.string().optional(),
})

export const Route = createFileRoute('/_app/books/')({
  validateSearch: searchSchema,
  component: CatalogPage,
})

function CatalogPage() {
  const { q, page, available, subject } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const listFn = useServerFn(listBooks)
  const borrowFn = useServerFn(borrowBook)
  const meFn = useServerFn(me)
  const queryClient = useQueryClient()

  const [term, setTerm] = useState(q ?? '')
  const toast = useToast()
  const currentPage = page ?? 1

  const { data: user } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => meFn({ data: undefined }) })
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'

  const { data, isLoading } = useQuery({
    queryKey: ['books', { q: q ?? '', page: currentPage }],
    queryFn: () => listFn({ data: { search: q, page: currentPage, limit: 20 } }),
  })

  const booksKey = ['books', { q: q ?? '', page: currentPage }] as const

  const borrow = useMutation({
    mutationFn: (bookId: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return Promise.reject(new Error('offline'))
      }
      return borrowFn({ data: { bookId } })
    },
    // Optimistic: mark the book unavailable immediately; roll back on error.
    onMutate: async (bookId: string) => {
      await queryClient.cancelQueries({ queryKey: booksKey })
      const prev = queryClient.getQueryData<{ items: Array<{ id: string; isAvailable: boolean }> }>(booksKey)
      if (prev) {
        queryClient.setQueryData(booksKey, {
          ...prev,
          items: prev.items.map((b) => (b.id === bookId ? { ...b, isAvailable: false } : b)),
        })
      }
      return { prev }
    },
    onSuccess: () => toast.success('Borrowed — see it in "My Books".'),
    onError: (e, _bookId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(booksKey, ctx.prev)
      toast.error(circulationErrorMessage(e))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
    },
  })

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const next = term.trim()
    navigate({ search: { q: next || undefined, page: undefined } })
  }

  function goToPage(p: number) {
    navigate({ search: (prev) => ({ ...prev, page: p === 1 ? undefined : p }) })
  }

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1

  // Derive subject chips from the current page's results.
  const allSubjects = useMemo(() => {
    const set = new Set<string>()
    for (const b of items) {
      for (const s of (b as { subjects?: string[] | null }).subjects ?? []) set.add(s)
    }
    return Array.from(set).sort().slice(0, 20)
  }, [items])

  const visibleItems = useMemo(
    () =>
      items.filter((b) => {
        if (available && !b.isAvailable) return false
        if (subject) {
          const subs = (b as { subjects?: string[] | null }).subjects ?? []
          if (!subs.includes(subject)) return false
        }
        return true
      }),
    [items, available, subject],
  )

  function toggleSubject(s: string) {
    navigate({ search: (prev) => ({ ...prev, subject: prev.subject === s ? undefined : s }) })
  }

  function toggleAvailable() {
    navigate({ search: (prev) => ({ ...prev, available: prev.available ? undefined : true }) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Library Catalog</h1>
        {isAdmin && (
          <Link to="/books/add" className={buttonVariants({ size: 'sm' })}>
            Add Book
          </Link>
        )}
      </div>

      <form onSubmit={submitSearch} className="flex gap-2" data-testid="search-form">
        <Input
          placeholder="Search by title or author…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          data-testid="search-input"
          aria-label="Search by title or author"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {q && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTerm('')
              navigate({ search: {} })
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Filters: available-only + subject chips */}
      {(allSubjects.length > 0 || available) && (
        <div className="flex flex-wrap items-center gap-2" data-testid="catalog-filters">
          <button
            type="button"
            onClick={toggleAvailable}
            aria-pressed={!!available}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              available
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input hover:bg-accent'
            }`}
          >
            Available only
          </button>
          {allSubjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSubject(s)}
              aria-pressed={subject === s}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                subject === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input hover:bg-accent'
              }`}
            >
              {s}
            </button>
          ))}
          {subject && (
            <Badge variant="outline" className="gap-1">
              Filtered: {subject}
            </Badge>
          )}
        </div>
      )}

      {isLoading && <BookListSkeleton />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          data-testid="no-books"
          icon="📚"
          title={q ? 'No books match your search' : 'No books in the catalog yet'}
          description={
            q
              ? 'Try a different title or author, or clear the search.'
              : isAdmin
                ? 'Add your first book to get started.'
                : 'Check back soon — your librarian is still stocking the shelves.'
          }
          action={
            q ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTerm('')
                  navigate({ search: {} })
                }}
              >
                Clear search
              </Button>
            ) : isAdmin ? (
              <Link to="/books/add" className={buttonVariants({ size: 'sm' })}>
                Add Book
              </Link>
            ) : undefined
          }
        />
      )}

      {!isLoading && items.length > 0 && visibleItems.length === 0 && (
        <p className="text-muted-foreground" data-testid="no-filtered-books">
          No books match the current filters.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => navigate({ search: (prev) => ({ ...prev, available: undefined, subject: undefined }) })}
          >
            Reset filters
          </button>
        </p>
      )}

      <div className="grid gap-4">
        {visibleItems.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onBorrow={(id) => borrow.mutate(id)}
            pending={borrow.isPending && borrow.variables === book.id}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2" data-testid="pagination">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
