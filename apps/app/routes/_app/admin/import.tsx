import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, Plural, useLingui } from '@lingui/react/macro'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/import')({
  beforeLoad: ({ context }) => {
    const user = context.user
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
  const { data: history } = useQuery(trpc.library.importHistory.queryOptions())
  const toast = useToast()
  const { t } = useLingui()
  const [fileName, setFileName] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [result, setResult] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')

  async function handleUrlImport() {
    const u = url.trim()
    if (!u) return
    setError(null)
    setResult(null)
    setCounts(null)
    setFileName(u)
    setBusy(true)
    try {
      // The Worker fetches + parses the URL (the browser can't fetch it
      // cross-origin). Preview first, then the admin confirms with Import.
      const preview = await trpcClient.library.importFanshuFromUrl.mutate({ url: u, preview: true })
      setCounts(preview)
      setSheets(null) // signals the commit path to use the URL, not parsed sheets
    } catch {
      setError(t`Could not fetch that URL. Paste a 番薯借阅 export link (https://…fanshujieyue.com/….xls).`)
    } finally {
      setBusy(false)
    }
  }

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
      setError(t`Could not read this file. Make sure it is a 番薯借阅 Excel export (.xls/.xlsx).`)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const res = sheets
        ? await trpcClient.library.importFanshu.mutate({ sheets, fileName: fileName ?? undefined })
        : await trpcClient.library.importFanshuFromUrl.mutate({ url: url.trim() })
      setResult(res)
      toast.success(t`Imported ${res.books} books, ${res.members} members, ${res.loans} loans.`)
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: trpc.library.importHistory.queryKey() })
    } catch {
      setError(t`Import failed. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">
        <Trans>Import from 番薯借阅</Trans>
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Upload export</Trans>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <Trans>
              Upload the 番薯借阅 Excel export (.xls). Books, members, loans, reviews and purchase
              requests are imported into this library. Re-importing updates existing rows (safe to
              run again).
            </Trans>
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

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> <Trans>or paste a link</Trans>{' '}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              placeholder={t`https://…fanshujieyue.com/…/librarydata_….xls`}
              data-testid="import-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <Button type="button" variant="outline" onClick={handleUrlImport} disabled={busy || !url.trim()}>
              <Trans>Fetch</Trans>
            </Button>
          </div>
          {busy && !result && (
            <p className="text-sm text-muted-foreground">
              <Trans>Working…</Trans>
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" data-testid="import-error">
              {error}
            </p>
          )}

          {counts && !result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
              <p className="font-medium">
                <Trans>Preview — {fileName ?? ''}</Trans>
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>
                  <Plural value={counts.books} one="# book" other="# books" />
                </li>
                <li>
                  <Plural value={counts.members} one="# member" other="# members" />
                </li>
                <li>
                  <Plural value={counts.loans} one="# loan" other="# loans" />
                </li>
                <li>
                  <Plural value={counts.reviews} one="# review" other="# reviews" />
                </li>
                <li>
                  <Plural
                    value={counts.purchaseRequests}
                    one="# purchase request"
                    other="# purchase requests"
                  />
                </li>
                {(counts.orphanLoans.noMember > 0 || counts.orphanLoans.noBook > 0) && (
                  <li className="text-amber-600">
                    <Plural
                      value={counts.orphanLoans.noMember + counts.orphanLoans.noBook}
                      one="# loan skipped (unmatched member/book)"
                      other="# loans skipped (unmatched member/book)"
                    />
                  </li>
                )}
              </ul>
              <Button className="mt-3" onClick={handleImport} disabled={busy}>
                {busy ? <Trans>Importing…</Trans> : <Trans>Import</Trans>}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-result">
              <p className="font-medium text-green-600">
                <Trans>Imported successfully</Trans>
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>
                  <Plural value={result.books} one="# book" other="# books" />
                </li>
                <li>
                  <Plural value={result.members} one="# member" other="# members" />
                </li>
                <li>
                  <Plural value={result.loans} one="# loan" other="# loans" />
                </li>
                <li>
                  <Plural value={result.reviews} one="# review" other="# reviews" />
                </li>
                <li>
                  <Plural
                    value={result.purchaseRequests}
                    one="# purchase request"
                    other="# purchase requests"
                  />
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card data-testid="import-history">
          <CardHeader>
            <CardTitle>
              <Trans>Import history</Trans>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              <Trans>Every import is recorded with its source and counts.</Trans>
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {history.map((run) => {
                const c = (run.counts ?? {}) as Record<string, number>
                return (
                  <li key={run.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                      <span
                        className={
                          run.status === 'success' ? 'text-green-600' : 'text-destructive'
                        }
                      >
                        {run.status === 'success' ? <Trans>success</Trans> : <Trans>failed</Trans>}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      <Trans>
                        {c.books ?? 0} books · {c.members ?? 0} members · {c.loans ?? 0} loans ·{' '}
                        {c.reviews ?? 0} reviews · {c.purchaseRequests ?? 0} requests
                      </Trans>
                    </p>
                    {(run.sourceUrl || run.fileName) && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        <Trans>Source: {run.sourceUrl ?? run.fileName ?? ''}</Trans>
                      </p>
                    )}
                    {run.r2Key && (
                      <p className="break-all text-xs text-muted-foreground">
                        <Trans>R2: {run.r2Key}</Trans>
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
