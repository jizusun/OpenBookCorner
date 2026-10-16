import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface BookCardBook {
  id: string
  title: string
  author: string
  isbn: string
  isAvailable: boolean
}

interface BookCardProps {
  book: BookCardBook
  onBorrow: (bookId: string) => void
  pending?: boolean
}

export function BookCard({ book, onBorrow, pending }: BookCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{book.title}</CardTitle>
        <p className="text-sm text-muted-foreground">by {book.author}</p>
        <p className="text-xs text-muted-foreground">ISBN: {book.isbn}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
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
      </CardContent>
    </Card>
  )
}
