import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getBook, getBookBorrower, deleteBook } from '@/server/functions/book'
import { borrowBook } from '@/server/functions/borrowing'
import { me } from '@/server/functions/auth'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/modal'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/books/$bookId')({ component: BookDetailPage })

function BookDetailPage() {
  const { bookId } = Route.useParams()
  const navigate = useNavigate()
  const getBookFn = useServerFn(getBook)
  const getBorrowerFn = useServerFn(getBookBorrower)
  const borrowFn = useServerFn(borrowBook)
  const deleteFn = useServerFn(deleteBook)
  const meFn = useServerFn(me)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: user } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => meFn({ data: undefined }) })
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookFn({ data: { bookId } }),
  })

  // Admin-only: who currently holds the book. Only query when admin + borrowed.
  const { data: borrower } = useQuery({
    queryKey: ['book-borrower', bookId],
    queryFn: () => getBorrowerFn({ data: { bookId } }),
    enabled: !!isAdmin && !!book && !book.isAvailable,
  })

  const borrow = useMutation({
    mutationFn: () => borrowFn({ data: { bookId } }),
    onSuccess: () => toast.success('Borrowed — see it in "My Books".'),
    onError: (e) => toast.error(circulationErrorMessage(e)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['book-borrower', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
    },
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { bookId } }),
    onSuccess: async () => {
      setConfirmOpen(false)
      toast.success('Book deleted.')
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      await navigate({ to: '/books' })
    },
    onError: (e) => {
      setConfirmOpen(false)
      toast.error(
        e instanceof Error && e.message.includes('BORROWED')
          ? 'This book is currently borrowed and cannot be deleted until it is returned.'
          : 'Could not delete the book.',
      )
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:flex-row">
          <Skeleton className="h-56 w-40 shrink-0 self-center sm:self-start" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    )
  }
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
                onClick={() => borrow.mutate()}
              >
                {borrow.isPending ? 'Borrowing…' : 'Borrow'}
              </Button>
            </div>

            {/* Admin: current borrower + due date */}
            {isAdmin && !book.isAvailable && borrower && (
              <div
                className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
                data-testid="borrower-info"
              >
                <span className="text-muted-foreground">Borrowed by </span>
                <span className="font-medium">{borrower.borrowerName}</span>
                <span className="text-muted-foreground"> ({borrower.borrowerEmail})</span>
                <span className="text-muted-foreground">
                  {' '}
                  · due {new Date(borrower.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}

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
                  onClick={() => setConfirmOpen(true)}
                >
                  {remove.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            )}

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

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this book?"
        description="This removes the book from the catalog and cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
