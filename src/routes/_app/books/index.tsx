import { useState } from 'react'
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

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/books/')({
  validateSearch: searchSchema,
  component: CatalogPage,
})

function CatalogPage() {
  const { q, page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const listFn = useServerFn(listBooks)
  const borrowFn = useServerFn(borrowBook)
  const meFn = useServerFn(me)
  const queryClient = useQueryClient()

  const [term, setTerm] = useState(q ?? '')
  const [borrowMsg, setBorrowMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const currentPage = page ?? 1

  const { data: user } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => meFn({ data: undefined }) })
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'

  const { data, isLoading } = useQuery({
    queryKey: ['books', { q: q ?? '', page: currentPage }],
    queryFn: () => listFn({ data: { search: q, page: currentPage, limit: 20 } }),
  })

  const borrow = useMutation({
    mutationFn: (bookId: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return Promise.reject(new Error('offline'))
      }
      return borrowFn({ data: { bookId } })
    },
    onSuccess: () => setBorrowMsg({ kind: 'ok', text: 'Borrowed — see it in "My Books".' }),
    onError: (e) => setBorrowMsg({ kind: 'err', text: circulationErrorMessage(e) }),
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

      {borrowMsg && (
        <div
          data-testid="borrow-msg"
          className={
            borrowMsg.kind === 'ok'
              ? 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
              : 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          }
        >
          {borrowMsg.text}
        </div>
      )}

      <form onSubmit={submitSearch} className="flex gap-2" data-testid="search-form">
        <Input
          placeholder="Search by title or author…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          data-testid="search-input"
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

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-muted-foreground" data-testid="no-books">
          No books found.
        </p>
      )}

      <div className="grid gap-4">
        {items.map((book) => (
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
