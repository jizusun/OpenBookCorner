import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface BookCardBook {
  id: string
  title: string
  author: string
  isbn: string
  isAvailable: boolean
  publisher?: string | null
  publishedYear?: number | null
  coverImageUrl?: string | null
}

interface BookCardProps {
  book: BookCardBook
  onBorrow: (bookId: string) => void
  pending?: boolean
}

export function BookCard({ book, onBorrow, pending }: BookCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="flex gap-4 p-4">
        {book.coverImageUrl ? (
          <img
            src={book.coverImageUrl}
            alt={`Cover of ${book.title}`}
            className="h-28 w-20 shrink-0 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
            No cover
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to="/books/$bookId"
            params={{ bookId: book.id }}
            className="font-semibold hover:underline"
          >
            {book.title}
          </Link>
          <p className="text-sm text-muted-foreground">by {book.author}</p>
          {(book.publisher || book.publishedYear) && (
            <p className="text-xs text-muted-foreground">
              {[book.publisher, book.publishedYear].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>

          <div className="mt-auto flex items-center justify-between pt-3">
            <Badge variant={book.isAvailable ? 'default' : 'secondary'}>
              {book.isAvailable ? 'Available' : 'Borrowed'}
            </Badge>
            <Button
              size="sm"
              disabled={!book.isAvailable || pending}
              onClick={() => onBorrow(book.id)}
            >
              Borrow
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
