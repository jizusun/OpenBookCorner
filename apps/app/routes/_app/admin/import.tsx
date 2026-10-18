import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
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
      setError(t('import.error.url'))
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
      setError(t('import.error.file'))
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
      toast.success(t('import.successToast', { books: res.books, members: res.members, loans: res.loans }))
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: trpc.library.importHistory.queryKey() })
    } catch {
      setError(t('import.error.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">{t('import.title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('import.uploadTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('import.uploadDesc')}
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
            <span className="h-px flex-1 bg-border" /> {t('import.orPasteLink')} <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              placeholder={t('import.urlPlaceholder')}
              data-testid="import-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <Button type="button" variant="outline" onClick={handleUrlImport} disabled={busy || !url.trim()}>
              {t('import.fetch')}
            </Button>
          </div>
          {busy && !result && <p className="text-sm text-muted-foreground">{t('import.working')}</p>}
          {error && <p className="text-sm text-destructive" data-testid="import-error">{error}</p>}

          {counts && !result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
              <p className="font-medium">{t('import.previewTitle', { fileName: fileName ?? '' })}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>{t('import.books', { count: counts.books })}</li>
                <li>{t('import.members', { count: counts.members })}</li>
                <li>{t('import.loans', { count: counts.loans })}</li>
                <li>{t('import.reviews', { count: counts.reviews })}</li>
                <li>{t('import.purchaseRequests', { count: counts.purchaseRequests })}</li>
                {(counts.orphanLoans.noMember > 0 || counts.orphanLoans.noBook > 0) && (
                  <li className="text-amber-600">
                    {t('import.loansSkipped', { count: counts.orphanLoans.noMember + counts.orphanLoans.noBook })}
                  </li>
                )}
              </ul>
              <Button className="mt-3" onClick={handleImport} disabled={busy}>
                {busy ? t('import.importing') : t('import.import')}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm" data-testid="import-result">
              <p className="font-medium text-green-600">{t('import.successTitle')}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>{t('import.books', { count: result.books })}</li>
                <li>{t('import.members', { count: result.members })}</li>
                <li>{t('import.loans', { count: result.loans })}</li>
                <li>{t('import.reviews', { count: result.reviews })}</li>
                <li>{t('import.purchaseRequests', { count: result.purchaseRequests })}</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card data-testid="import-history">
          <CardHeader>
            <CardTitle>{t('import.historyTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('import.historyDesc')}
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
                        {run.status === 'success'
                          ? t('import.historyStatus.success')
                          : t('import.historyStatus.failed')}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {t('import.historyCounts', {
                        books: c.books ?? 0,
                        members: c.members ?? 0,
                        loans: c.loans ?? 0,
                        reviews: c.reviews ?? 0,
                        requests: c.purchaseRequests ?? 0,
                      })}
                    </p>
                    {(run.sourceUrl || run.fileName) && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {t('import.source', { source: run.sourceUrl ?? run.fileName ?? '' })}
                      </p>
                    )}
                    {run.r2Key && (
                      <p className="break-all text-xs text-muted-foreground">{t('import.r2', { key: run.r2Key })}</p>
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
