import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { IsbnScanner } from '@/components/barcode/IsbnScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/books/add')({ component: AddBookPage })

function AddBookPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  // Metadata captured from the Open Library lookup (saved with the book).
  const [meta, setMeta] = useState<{
    publisher?: string
    publishedYear?: number
    coverImageUrl?: string
    description?: string
    subjects?: string[]
  }>({})
  const [scanning, setScanning] = useState(false)
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Look up metadata for an ISBN and auto-fill editable fields.
  async function lookup(isbnValue: string) {
    const value = isbnValue.trim()
    if (!value) return
    setLooking(true)
    setError(null)
    setInfo(null)
    try {
      const m = await trpcClient.book.lookupIsbn.query({ isbn: value })
      if (m) {
        if (m.title) setTitle(m.title)
        if (m.author) setAuthor(m.author)
        setMeta({
          publisher: m.publisher,
          publishedYear: m.publishedYear,
          coverImageUrl: m.coverImageUrl,
          description: m.description,
          subjects: m.subjects,
        })
        setInfo('Details auto-filled from Open Library. You can edit the title/author before saving.')
      } else {
        setMeta({})
        setInfo('ISBN not found online. Enter the title and author manually.')
      }
    } catch {
      setMeta({})
      setInfo('Lookup failed. Enter the title and author manually.')
    } finally {
      setLooking(false)
    }
  }

  function handleScanned(scanned: string) {
    setIsbn(scanned)
    setScanning(false)
    void lookup(scanned)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setPending(true)
    try {
      await trpcClient.book.add.mutate({
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim(),
        publisher: meta.publisher,
        publishedYear: meta.publishedYear,
        coverImageUrl: meta.coverImageUrl,
        description: meta.description,
        subjects: meta.subjects,
      })
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      setSuccess(`"${title.trim()}" added to the catalog.`)
      toast.success(`"${title.trim()}" added to the catalog.`)
      setTitle('')
      setAuthor('')
      setIsbn('')
      setMeta({})
      setInfo(null)
    } catch (err) {
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
          <p className="text-sm text-muted-foreground">
            Scan an ISBN to auto-fill, or enter details manually.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-book-form">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="isbn">ISBN</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScanning((s) => !s)}
                  data-testid="scan-toggle"
                >
                  {scanning ? 'Close scanner' : 'Scan ISBN'}
                </Button>
              </div>
              <Input
                id="isbn"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                onBlur={(e) => lookup(e.target.value)}
                required
              />
              {scanning && (
                <IsbnScanner onDetected={handleScanned} onClose={() => setScanning(false)} />
              )}
              {looking && <p className="text-xs text-muted-foreground">Looking up ISBN…</p>}
              {info && <p className="text-xs text-muted-foreground" data-testid="lookup-info">{info}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
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
