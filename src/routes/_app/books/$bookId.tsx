import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getBook, deleteBook } from '@/server/functions/book'
import { borrowBook } from '@/server/functions/borrowing'
import { me } from '@/server/functions/auth'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { circulationErrorMessage } from '@/lib/errors'

export const Route = createFileRoute('/_app/books/$bookId')({ component: BookDetailPage })

function BookDetailPage() {
  const { bookId } = Route.useParams()
  const navigate = useNavigate()
  const getBookFn = useServerFn(getBook)
  const borrowFn = useServerFn(borrowBook)
  const deleteFn = useServerFn(deleteBook)
  const meFn = useServerFn(me)
  const queryClient = useQueryClient()

  const { data: user } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => meFn({ data: undefined }) })
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookFn({ data: { bookId } }),
  })

  const borrow = useMutation({
    mutationFn: () => borrowFn({ data: { bookId } }),
    onError: (e) => setBorrowError(circulationErrorMessage(e)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
    },
  })

  const [borrowError, setBorrowError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { bookId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await navigate({ to: '/books' })
    },
    onError: (e) => {
      setDeleteError(
        e instanceof Error && e.message.includes('BORROWED')
          ? 'This book is currently borrowed and cannot be deleted until it is returned.'
          : 'Could not delete the book.',
      )
    },
  })

  function confirmDelete() {
    setDeleteError(null)
    if (typeof window !== 'undefined' && window.confirm('Delete this book from the catalog? This cannot be undone.')) {
      remove.mutate()
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!book) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Book not found.</p>
        <Link to="/books" className="text-primary underline">
          Back to catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/books" className="text-sm text-primary underline">
        ← Back to catalog
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={`Cover of ${book.title}`}
              className="h-56 w-40 shrink-0 self-center rounded object-cover shadow sm:self-start"
              loading="lazy"
            />
          ) : (
            <div className="flex h-56 w-40 shrink-0 items-center justify-center self-center rounded bg-muted text-sm text-muted-foreground sm:self-start">
              No cover
            </div>
          )}

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold">{book.title}</h1>
              <p className="text-muted-foreground">by {book.author}</p>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {book.publisher && (
                <>
                  <dt className="text-muted-foreground">Publisher</dt>
                  <dd>{book.publisher}</dd>
                </>
              )}
              {book.publishedYear && (
                <>
                  <dt className="text-muted-foreground">Published</dt>
                  <dd>{book.publishedYear}</dd>
                </>
              )}
              <dt className="text-muted-foreground">ISBN</dt>
              <dd>{book.isbn}</dd>
            </dl>

            <div className="flex items-center gap-3">
              <Badge variant={book.isAvailable ? 'default' : 'secondary'}>
                {book.isAvailable ? 'Available' : 'Borrowed'}
              </Badge>
              <Button
                size="sm"
                disabled={!book.isAvailable || borrow.isPending}
                onClick={() => {
                  setBorrowError(null)
                  borrow.mutate()
                }}
              >
                {borrow.isPending ? 'Borrowing…' : 'Borrow'}
              </Button>
            </div>

            {borrowError && <p className="text-sm text-destructive" data-testid="borrow-error">{borrowError}</p>}

            {isAdmin && (
              <div className="flex items-center gap-2 pt-1" data-testid="admin-controls">
                <Link
                  to="/books/$bookId/edit"
                  params={{ bookId }}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Edit
                </Link>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={confirmDelete}
                >
                  {remove.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            )}
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

            {book.subjects && book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {book.subjects.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {book.description && (
              <div className="pt-2">
                <h2 className="mb-1 font-semibold">Description</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {book.description}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
