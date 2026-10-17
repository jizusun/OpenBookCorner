import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/import')({
  beforeLoad: async () => {
    const user = await trpcClient.auth.requireMe.query()
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: ImportPage,
})

// 番薯 sheet names → our FanshuSheets keys.
const SHEET_MAP: Record<string, keyof Sheets> = {
  书籍清单: 'books',
  存量明细: 'stock',
  成员清单: 'members',
  借阅清单: 'loans',
  评论清单: 'reviews',
  荐购清单: 'purchaseRequests',
}

type Row = Record<string, unknown>
interface Sheets {
  books: Row[]
  stock: Row[]
  members: Row[]
  loans: Row[]
  reviews: Row[]
  purchaseRequests: Row[]
}
const emptySheets = (): Sheets => ({
  books: [],
  stock: [],
  members: [],
  loans: [],
  reviews: [],
  purchaseRequests: [],
})

interface Counts {
  books: number
  members: number
  loans: number
  reviews: number
  purchaseRequests: number
  orphanLoans: { noMember: number; noBook: number }
}

function ImportPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [fileName, setFileName] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [result, setResult] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setResult(null)
    setCounts(null)
    setFileName(file.name)
    setBusy(true)
    try {
      // Lazy-load SheetJS so it stays out of the main bundle (parse in the browser).
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const parsed = emptySheets()
      for (const name of wb.SheetNames) {
        const key = SHEET_MAP[name]
        if (!key) continue
        parsed[key] = XLSX.utils.sheet_to_json(wb.Sheets[name]!, { defval: '' }) as Row[]
      }
      setSheets(parsed)
      const preview = await trpcClient.library.importFanshuPreview.mutate({ sheets: parsed })
      setCounts(preview)
    } catch {
      setError('Could not read this file. Make sure it is a 番薯借阅 Excel export (.xls/.xlsx).')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!sheets) return
    setBusy(true)
    setError(null)
    try {
      const res = await trpcClient.library.importFanshu.mutate({ sheets })
      setResult(res)
      toast.success(`Imported ${res.books} books, ${res.members} members, ${res.loans} loans.`)
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
    } catch {
      setError('Import failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Import from 番薯借阅</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upload export</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload the 番薯借阅 Excel export (.xls). Books, members, loans, reviews and
            purchase requests are imported into this library. Re-importing updates
            existing rows (safe to run again).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel"
            data-testid="import-file"
            onChange={handleFile}
            className="block w-full text-sm"
          />
          {busy && !result && <p className="text-sm text-muted-foreground">Working…</p>}
          {error && <p className="text-sm text-destructive" data-testid="import-error">{error}</p>}

          {counts && !result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
              <p className="font-medium">Preview — {fileName}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>{counts.books} books</li>
                <li>{counts.members} members</li>
                <li>{counts.loans} loans</li>
                <li>{counts.reviews} reviews</li>
                <li>{counts.purchaseRequests} purchase requests</li>
                {(counts.orphanLoans.noMember > 0 || counts.orphanLoans.noBook > 0) && (
                  <li className="text-amber-600">
                    {counts.orphanLoans.noMember + counts.orphanLoans.noBook} loans skipped
                    (unmatched member/book)
                  </li>
                )}
              </ul>
              <Button className="mt-3" onClick={handleImport} disabled={busy}>
                {busy ? 'Importing…' : 'Import'}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-result">
              <p className="font-medium text-green-600">Imported successfully</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>{result.books} books</li>
                <li>{result.members} members</li>
                <li>{result.loans} loans</li>
                <li>{result.reviews} reviews</li>
                <li>{result.purchaseRequests} purchase requests</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
