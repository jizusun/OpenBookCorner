import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getBook } from '@/server/functions/book'
import { borrowBook } from '@/server/functions/borrowing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/_app/books/$bookId')({ component: BookDetailPage })

function BookDetailPage() {
  const { bookId } = Route.useParams()
  const getBookFn = useServerFn(getBook)
  const borrowFn = useServerFn(borrowBook)
  const queryClient = useQueryClient()

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookFn({ data: { bookId } }),
  })

  const borrow = useMutation({
    mutationFn: () => borrowFn({ data: { bookId } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
    },
  })

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
                onClick={() => borrow.mutate()}
              >
                {borrow.isPending ? 'Borrowing…' : 'Borrow'}
              </Button>
            </div>

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
