import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { listBooks } from '@/server/functions/book'
import { borrowBook } from '@/server/functions/borrowing'
import { BookCard } from '@/components/books/BookCard'

export const Route = createFileRoute('/_app/books/')({ component: CatalogPage })

function CatalogPage() {
  const listFn = useServerFn(listBooks)
  const borrowFn = useServerFn(borrowBook)
  const queryClient = useQueryClient()

  const { data: books, isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => listFn({ data: undefined }),
  })

  const borrow = useMutation({
    mutationFn: (bookId: string) => borrowFn({ data: { bookId } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Library Catalog</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {books && books.length === 0 && (
        <p className="text-muted-foreground">No books in the catalog yet.</p>
      )}
      <div className="grid gap-4">
        {books?.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onBorrow={(id) => borrow.mutate(id)}
            pending={borrow.isPending && borrow.variables === book.id}
          />
        ))}
      </div>
    </div>
  )
}
