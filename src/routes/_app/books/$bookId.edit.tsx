import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { getBook, updateBook } from '@/server/functions/book'
import { me } from '@/server/functions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/books/$bookId/edit')({
  beforeLoad: async () => {
    const user = await me()
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: EditBookPage,
})

function EditBookPage() {
  const { bookId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const getBookFn = useServerFn(getBook)
  const updateFn = useServerFn(updateBook)
  const toast = useToast()

  const { data: book, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBookFn({ data: { bookId } }),
  })

  const [form, setForm] = useState<null | {
    title: string
    author: string
    isbn: string
    publisher: string
    publishedYear: string
    description: string
  }>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Initialize the form once the book loads.
  const current =
    form ??
    (book
      ? {
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisher: book.publisher ?? '',
          publishedYear: book.publishedYear ? String(book.publishedYear) : '',
          description: book.description ?? '',
        }
      : null)

  function set(field: string, value: string) {
    if (!current) return
    setForm({ ...current, [field]: value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!current) return
    setError(null)
    setPending(true)
    try {
      await updateFn({
        data: {
          bookId,
          title: current.title.trim(),
          author: current.author.trim(),
          isbn: current.isbn.trim(),
          publisher: current.publisher.trim() || undefined,
          publishedYear: current.publishedYear ? Number(current.publishedYear) : undefined,
          description: current.description.trim() || undefined,
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      toast.success('Changes saved.')
      await navigate({ to: '/books/$bookId', params: { bookId } })
    } catch {
      setError('Could not save changes. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (isLoading || !current) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Edit Book</h1>
      <Card>
        <CardHeader>
          <CardTitle>{book?.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="edit-book-form">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={current.title} onChange={(e) => set('title', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" value={current.author} onChange={(e) => set('author', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" value={current.isbn} onChange={(e) => set('isbn', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input id="publisher" value={current.publisher} onChange={(e) => set('publisher', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publishedYear">Published year</Label>
              <Input
                id="publishedYear"
                type="number"
                value={current.publishedYear}
                onChange={(e) => set('publishedYear', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={current.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate({ to: '/books/$bookId', params: { bookId } })}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
