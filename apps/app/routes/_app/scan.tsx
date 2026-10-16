import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { IsbnScanner } from '@/components/barcode/IsbnScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { circulationErrorMessage } from '@/lib/errors'

export const Route = createFileRoute('/_app/scan')({ component: ScanToBorrowPage })

function ScanToBorrowPage() {
  const queryClient = useQueryClient()
  const [scanning, setScanning] = useState(false)
  const [isbn, setIsbn] = useState('')
  const [result, setResult] = useState<
    { kind: 'ok'; title: string; dueDate: string } | { kind: 'err'; text: string } | null
  >(null)

  const borrow = useMutation({
    ...trpc.borrowing.borrowByIsbn.mutationOptions(),
    onSuccess: (res) => {
      setResult({ kind: 'ok', title: res.title, dueDate: res.dueDate })
      queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.borrowing.myBooks.queryKey() })
    },
    onError: (e) => setResult({ kind: 'err', text: circulationErrorMessage(e) }),
  })

  function submit(value: string) {
    const v = value.trim()
    if (!v) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setResult({ kind: 'err', text: circulationErrorMessage(new Error('offline')) })
      return
    }
    setResult(null)
    borrow.mutate({ isbn: v })
  }

  function handleScanned(scanned: string) {
    setIsbn(scanned)
    setScanning(false)
    submit(scanned)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Scan to Borrow</h1>
      <p className="text-sm text-muted-foreground">
        Scan a book's barcode (or type its ISBN) to borrow it instantly.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Borrow by ISBN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="scan-isbn">ISBN</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScanning((s) => !s)}
              data-testid="scan-toggle"
            >
              {scanning ? 'Close scanner' : 'Scan barcode'}
            </Button>
          </div>

          {scanning && <IsbnScanner onDetected={handleScanned} onClose={() => setScanning(false)} />}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(isbn)
            }}
            className="flex gap-2"
          >
            <Input
              id="scan-isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="e.g. 9780132350884"
            />
            <Button type="submit" disabled={borrow.isPending || !isbn.trim()}>
              {borrow.isPending ? 'Borrowing…' : 'Borrow'}
            </Button>
          </form>

          {result?.kind === 'ok' && (
            <div
              data-testid="scan-success"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800"
            >
              Borrowed <strong>{result.title}</strong> — due{' '}
              {new Date(result.dueDate).toLocaleDateString()}.{' '}
              <Link to="/my-books" className="underline">
                View in My Books
              </Link>
            </div>
          )}
          {result?.kind === 'err' && (
            <p className="text-sm text-destructive" data-testid="scan-error">
              {result.text}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
