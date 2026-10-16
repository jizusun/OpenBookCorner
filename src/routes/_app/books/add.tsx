import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { addBook } from '@/server/functions/book'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_app/books/add')({ component: AddBookPage })

function AddBookPage() {
  const addFn = useServerFn(addBook)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPending(true)
    try {
      await addFn({ data: { title: title.trim(), author: author.trim(), isbn: isbn.trim() } })
      await queryClient.invalidateQueries({ queryKey: ['books'] })
      setSuccess(`"${title.trim()}" added to the catalog.`)
      setTitle('')
      setAuthor('')
      setIsbn('')
    } catch (err) {
      // Admin guard throws "Insufficient permissions" for non-admins.
      setError(
        err instanceof Error && err.message.includes('permission')
          ? 'You do not have permission to add books.'
          : 'Could not add the book. Please check the fields and try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add Book</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/books' })}>
          Back to catalog
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book details</CardTitle>
          <p className="text-sm text-muted-foreground">Manually add a book to your library.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-book-form">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="add-error">{error}</p>}
            {success && (
              <p className="text-sm text-green-600" data-testid="add-success">
                {success}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Adding…' : 'Add Book'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
