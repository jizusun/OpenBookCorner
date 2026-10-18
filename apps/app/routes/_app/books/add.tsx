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
import { useI18n } from '@/lib/i18n'

export const Route = createFileRoute('/_app/books/add')({ component: AddBookPage })

function AddBookPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()

  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [quantity, setQuantity] = useState('1')
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
        setInfo(t('addBook.info.autofilled'))
      } else {
        setMeta({})
        setInfo(t('addBook.info.notFound'))
      }
    } catch {
      setMeta({})
      setInfo(t('addBook.info.lookupFailed'))
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
        quantity: Math.max(1, Number(quantity) || 1),
        publisher: meta.publisher,
        publishedYear: meta.publishedYear,
        coverImageUrl: meta.coverImageUrl,
        description: meta.description,
        subjects: meta.subjects,
      })
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      setSuccess(t('addBook.addedToast', { title: title.trim() }))
      toast.success(t('addBook.addedToast', { title: title.trim() }))
      setTitle('')
      setAuthor('')
      setIsbn('')
      setQuantity('1')
      setMeta({})
      setInfo(null)
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('permission')
          ? t('addBook.error.permission')
          : t('addBook.error.generic'),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('addBook.title')}</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/books' })}>
          {t('addBook.backToCatalog')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('addBook.details')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('addBook.hint')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-book-form">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="isbn">{t('addBook.isbn')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setScanning((s) => !s)}
                  data-testid="scan-toggle"
                >
                  {scanning ? t('addBook.closeScanner') : t('addBook.scanIsbn')}
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
              {looking && <p className="text-xs text-muted-foreground">{t('addBook.lookingUp')}</p>}
              {info && <p className="text-xs text-muted-foreground" data-testid="lookup-info">{info}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t('addBook.titleField')}</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">{t('addBook.author')}</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">{t('addBook.copies')}</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive" data-testid="add-error">{error}</p>}
            {success && (
              <p className="text-sm text-green-600" data-testid="add-success">
                {success}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t('addBook.adding') : t('addBook.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
