import { useState } from 'react'
import { FormPageSkeleton } from '@/components/ui/skeleton'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, Plural, useLingui } from '@lingui/react/macro'
import { ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/import')({
  pendingComponent: () => <FormPageSkeleton />,
  beforeLoad: ({ context }) => {
    const user = context.user
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: ImportPage,
})

interface Counts {
  books: number
  members: number
  loans: number
  reviews: number
  purchaseRequests: number
  orphanLoans: { noMember: number; noBook: number }
}
interface RunRow {
  id: string
  createdAt: string
  status: string
  fileName?: string | null
  sourceUrl?: string | null
  r2Key?: string | null
  ranByUserId?: string | null
  ranByUserName?: string | null
  counts?: Record<string, number> | null
  error?: string | null
}

function CountList({ c }: { c: Counts }) {
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
      <li><Plural value={c.books} one="# book" other="# books" /></li>
      <li><Plural value={c.members} one="# member" other="# members" /></li>
      <li><Plural value={c.loans} one="# loan" other="# loans" /></li>
      <li><Plural value={c.reviews} one="# review" other="# reviews" /></li>
      <li><Plural value={c.purchaseRequests} one="# purchase request" other="# purchase requests" /></li>
      {(c.orphanLoans.noMember > 0 || c.orphanLoans.noBook > 0) && (
        <li className="text-amber-600">
          <Plural
            value={c.orphanLoans.noMember + c.orphanLoans.noBook}
            one="# loan skipped (unmatched member/book)"
            other="# loans skipped (unmatched member/book)"
          />
        </li>
      )}
    </ul>
  )
}

function ImportPage() {
  const queryClient = useQueryClient()
  const { data: history } = useQuery(api.library.importHistory.queryOptions())
  const toast = useToast()
  const { t } = useLingui()

  const [counts, setCounts] = useState<Counts | null>(null)
  const [result, setResult] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')
  // For file upload we keep the File object (not pre-parsed sheets)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingUrl, setPendingUrl] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setResult(null); setCounts(null); setPendingFile(file); setPendingUrl('')
    setBusy(true)
    try {
      // Preview via the legacy browser-parse path (fast, no upload yet).
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetMap: Record<string, string> = {
        '书籍清单': 'books', '存量明细': 'stock', '成员清单': 'members',
        '借阅清单': 'loans', '评论清单': 'reviews', '荐购清单': 'purchaseRequests',
      }
      const sheets: Record<string, unknown[]> = { books: [], stock: [], members: [], loans: [], reviews: [], purchaseRequests: [] }
      for (const name of wb.SheetNames) {
        const key = sheetMap[name]
        if (key) sheets[key] = XLSX.utils.sheet_to_json(wb.Sheets[name]!, { defval: '' }) as unknown[]
      }
      const preview = await api.library.importFanshuPreview.mutate({ sheets: sheets as never })
      setCounts(preview)
    } catch {
      setError(t`Could not read this file. Make sure it is a 番薯借阅 Excel export (.xls/.xlsx).`)
    } finally {
      setBusy(false)
    }
  }

  async function handleUrlFetch() {
    const u = url.trim()
    if (!u) return
    setError(null); setResult(null); setCounts(null); setPendingFile(null); setPendingUrl(u)
    setBusy(true)
    try {
      const preview = await api.library.importFanshuFromUrl.mutate({ url: u, preview: true })
      setCounts(preview)
    } catch {
      setError(t`Could not fetch that URL. Paste a 番薯借阅 export link (https://…fanshujieyue.com/….xls).`)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true); setError(null)
    try {
      let res: Counts
      if (pendingFile) {
        // Upload raw file → server parses + archives to R2 (preserves original).
        const fd = new FormData()
        fd.append('file', pendingFile)
        const resp = await fetch('/api/library/import/file', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (!resp.ok) throw new Error(await resp.text())
        res = await resp.json() as Counts
      } else {
        // URL path: server fetches + archives to R2.
        res = await api.library.importFanshuFromUrl.mutate({ url: pendingUrl })
      }
      setResult(res)
      toast.success(t`Imported ${res.books} books, ${res.members} members, ${res.loans} loans.`)
      await queryClient.invalidateQueries({ queryKey: api.book.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: api.library.importHistory.queryKey() })
    } catch {
      setError(t`Import failed. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold"><Trans>Import from 番薯借阅</Trans></h1>

      {/* Upload card */}
      <Card>
        <CardHeader>
          <CardTitle><Trans>Upload export</Trans></CardTitle>
          <CardDescription>
            <Trans>
              Upload the 番薯借阅 Excel export (.xls). Books, members, loans, reviews and purchase
              requests are imported into this library. Re-importing updates existing rows safely.
              The original file is archived to R2 for auditability.
            </Trans>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" accept=".xls,.xlsx,application/vnd.ms-excel"
            data-testid="import-file" onChange={handleFile} className="block w-full text-sm" />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <Trans>or paste a link</Trans>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input type="url" inputMode="url"
              placeholder={t`https://…fanshujieyue.com/…/librarydata_….xls`}
              data-testid="import-url" value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-md border px-2 py-1 text-sm" />
            <Button type="button" variant="outline" onClick={handleUrlFetch}
              disabled={busy || !url.trim()}>
              <Trans>Fetch</Trans>
            </Button>
          </div>

          {busy && !result && (
            <p className="text-sm text-muted-foreground"><Trans>Working…</Trans></p>
          )}
          {error && (
            <p className="text-sm text-destructive" data-testid="import-error">{error}</p>
          )}

          {counts && !result && (
            <div className="rounded-md border p-3" data-testid="import-preview">
              <p className="text-sm font-medium">
                <Trans>Preview — {pendingFile?.name ?? pendingUrl}</Trans>
              </p>
              <CountList c={counts} />
              <Button className="mt-3" onClick={handleImport} disabled={busy}>
                {busy ? <Trans>Importing…</Trans> : <Trans>Import</Trans>}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3" data-testid="import-result">
              <p className="text-sm font-medium text-green-600"><Trans>Imported successfully</Trans></p>
              <CountList c={result} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import history */}
      {history && history.length > 0 && (
        <Card data-testid="import-history">
          <CardHeader>
            <CardTitle><Trans>Import history</Trans></CardTitle>
            <CardDescription>
              <Trans>Every import is recorded — who imported, when, from where, and where the file is stored.</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {(history as RunRow[]).map((run) => {
                const c = (run.counts ?? {}) as Record<string, number>
                const source = run.sourceUrl ?? run.fileName ?? '—'
                return (
                  <li key={run.id} className="rounded-md border p-3 space-y-1.5">
                    {/* Who + when + status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                        {run.ranByUserName && (
                          <span className="ml-2 text-muted-foreground">
                            <Trans>by {run.ranByUserName}</Trans>
                          </span>
                        )}
                      </div>
                      <Badge variant={run.status === 'success' ? 'default' : 'destructive'}>
                        {run.status === 'success' ? <Trans>success</Trans> : <Trans>failed</Trans>}
                      </Badge>
                    </div>

                    {/* Counts */}
                    {run.status === 'success' && (
                      <p className="text-xs text-muted-foreground">
                        {c.books ?? 0} <Trans>books</Trans> ·{' '}
                        {c.members ?? 0} <Trans>members</Trans> ·{' '}
                        {c.loans ?? 0} <Trans>loans</Trans>
                      </p>
                    )}

                    {/* Source (where from) */}
                    <div className="flex items-start gap-1 text-xs text-muted-foreground">
                      <span className="shrink-0 font-medium"><Trans>Source:</Trans></span>
                      {run.sourceUrl ? (
                        <a href={run.sourceUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-0.5 break-all text-primary hover:underline">
                          {run.sourceUrl.length > 60 ? run.sourceUrl.slice(0, 60) + '…' : run.sourceUrl}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="break-all">{run.fileName ?? '—'}</span>
                      )}
                    </div>

                    {/* R2 key (where stored) */}
                    {run.r2Key ? (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <span className="shrink-0 font-medium"><Trans>Archived:</Trans></span>
                        <code className="break-all rounded bg-muted px-1">{run.r2Key}</code>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">
                        <Trans>File not archived (pre-R2 import)</Trans>
                      </p>
                    )}

                    {run.error && (
                      <p className="text-xs text-destructive">{run.error}</p>
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
