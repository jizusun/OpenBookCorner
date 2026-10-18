import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { IsbnScanner } from '@/components/barcode/IsbnScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { circulationErrorMessage } from '@/lib/errors'
import { Trans, useLingui } from '@lingui/react/macro'

export const Route = createFileRoute('/_app/scan')({ component: ScanToBorrowPage })

function ScanToBorrowPage() {
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const [scanning, setScanning] = useState(false)
  const [isbn, setIsbn] = useState('')
  const [result, setResult] = useState<
    { kind: 'ok'; title: string; dueDate: string } | { kind: 'err'; text: string } | null
  >(null)

  const borrow = useMutation({
    ...api.borrowing.borrowByIsbn.mutationOptions(),
    onSuccess: (res) => {
      setResult({ kind: 'ok', title: res.title, dueDate: res.dueDate })
      queryClient.invalidateQueries({ queryKey: api.book.list.queryKey() })
      queryClient.invalidateQueries({ queryKey: api.borrowing.myBooks.queryKey() })
    },
    onError: (e) => setResult({ kind: 'err', text: circulationErrorMessage(e) }),
  })

  function submit(value: string) {
    const v = value.trim()
    if (!v) return
    // No client-side navigator.onLine gate: it falsely reports offline inside
    // WeChat's WebView. Let the request run; a genuine network failure is mapped
    // to a friendly offline message by circulationErrorMessage in onError.
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
      <h1 className="text-2xl font-bold"><Trans>Scan to Borrow</Trans></h1>
      <p className="text-sm text-muted-foreground"><Trans>Scan a book’s barcode (or type its ISBN) to borrow it instantly.</Trans></p>

      <Card>
        <CardHeader>
          <CardTitle><Trans>Borrow by ISBN</Trans></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="scan-isbn"><Trans>ISBN</Trans></Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScanning((s) => !s)}
              data-testid="scan-toggle"
            >
              {scanning ? <Trans>Close scanner</Trans> : <Trans>Scan barcode</Trans>}
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
              placeholder={t`e.g. 9780132350884`}
            />
            <Button type="submit" disabled={borrow.isPending || !isbn.trim()}>
              {borrow.isPending ? <Trans>Borrowing…</Trans> : <Trans>Borrow</Trans>}
            </Button>
          </form>

          {result?.kind === 'ok' && (
            <div
              data-testid="scan-success"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800"
            >
              <Trans>
                Borrowed <strong>{result.title}</strong> — due{' '}
                {new Date(result.dueDate).toLocaleDateString()}
              </Trans>{' '}
              <Link to="/my-books" className="underline">
                <Trans>View in My Books</Trans>
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
