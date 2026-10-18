import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/modal'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { useViewMode } from '@/lib/view-mode'
import { useI18n } from '@/lib/i18n'

export const Route = createFileRoute('/_app/books/$bookId')({ component: BookDetailPage })

function BookDetailPage() {
  const { bookId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()

  const { data: user } = useQuery(trpc.auth.me.queryOptions())
  const isAdmin = user?.role === 'library_admin' || user?.role === 'super_admin'
  const viewMode = useViewMode()
  // Manage mode = admin in Admin view: show Edit/Delete + borrower, hide Borrow.
  const manageMode = isAdmin && viewMode === 'admin'

  const { data: book, isLoading } = useQuery(trpc.book.get.queryOptions({ bookId }))

  // Admin-only: who currently holds the book. Only query when admin + borrowed.
  const { data: borrower } = useQuery({
    ...trpc.book.borrower.queryOptions({ bookId }),
    enabled: !!manageMode && !!book && book.availableCount < book.quantity,
  })

  const borrow = useMutation({
    ...trpc.borrowing.borrow.mutationOptions(),
    onSuccess: () => toast.success(t('book.borrowedToast')),
    onError: (e) => toast.error(circulationErrorMessage(e, t)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.book.get.queryKey({ bookId }) })
      queryClient.invalidateQueries({ queryKey: trpc.book.borrower.queryKey({ bookId }) })
      queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      queryClient.invalidateQueries({ queryKey: trpc.borrowing.myBooks.queryKey() })
    },
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useMutation({
    ...trpc.book.remove.mutationOptions(),
    onSuccess: async () => {
      setConfirmOpen(false)
      toast.success(t('bookDetail.deletedToast'))
      await queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
      await navigate({ to: '/books' })
    },
    onError: (e) => {
      setConfirmOpen(false)
      toast.error(
        e instanceof Error && e.message.includes('BORROWED')
          ? t('bookDetail.deleteBorrowedError')
          : t('bookDetail.deleteError'),
      )
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-6 rounded-xl border bg-card p-6 sm:flex-row">
          <Skeleton className="h-56 w-40 shrink-0 self-center sm:self-start" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    )
  }
  if (!book) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">{t('bookDetail.notFound')}</p>
        <Link to="/books" className="text-primary underline">
          {t('addBook.backToCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to="/books" className="text-sm text-primary underline">
        {t('common.backToCatalog')}
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={t('bookDetail.coverAlt', { title: book.title })}
              className="h-56 w-40 shrink-0 self-center rounded object-cover shadow sm:self-start"
              loading="lazy"
            />
          ) : (
            <div className="flex h-56 w-40 shrink-0 items-center justify-center self-center rounded bg-muted text-sm text-muted-foreground sm:self-start">
              {t('myBooks.noCover')}
            </div>
          )}

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-bold">{book.title}</h1>
              <p className="text-muted-foreground">{t('bookDetail.byAuthor', { author: book.author })}</p>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {book.publisher && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.publisher')}</dt>
                  <dd>{book.publisher}</dd>
                </>
              )}
              {book.translator && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.translator')}</dt>
                  <dd>{book.translator}</dd>
                </>
              )}
              {(book.publishedDate || book.publishedYear) && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.published')}</dt>
                  <dd>{book.publishedDate ?? book.publishedYear}</dd>
                </>
              )}
              <dt className="text-muted-foreground">ISBN</dt>
              <dd>{book.isbn}</dd>
              {book.category && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.category')}</dt>
                  <dd>{book.category}</dd>
                </>
              )}
              {book.shelfLocation && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.shelf')}</dt>
                  <dd>{book.shelfLocation}</dd>
                </>
              )}
              {book.copyCode && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.code')}</dt>
                  <dd>{book.copyCode}</dd>
                </>
              )}
              {book.series && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.series')}</dt>
                  <dd>{book.series}</dd>
                </>
              )}
              {book.cnLibraryClass && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.clc')}</dt>
                  <dd>{book.cnLibraryClass}</dd>
                </>
              )}
              {book.pageCount != null && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.pages')}</dt>
                  <dd>{book.pageCount}</dd>
                </>
              )}
              {book.wordCount != null && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.words')}</dt>
                  <dd>{book.wordCount}</dd>
                </>
              )}
              {book.price && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.price')}</dt>
                  <dd>
                    {book.price} {book.priceUnit}
                  </dd>
                </>
              )}
              {book.isShelved != null && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.shelved')}</dt>
                  <dd>{book.isShelved ? t('bookDetail.yes') : t('bookDetail.no')}</dd>
                </>
              )}
              {book.enteredAt && (
                <>
                  <dt className="text-muted-foreground">{t('bookDetail.entered')}</dt>
                  <dd>{new Date(book.enteredAt).toLocaleString()}</dd>
                </>
              )}
            </dl>

            <div className="flex items-center gap-3">
              <Badge variant={book.availableCount > 0 ? 'default' : 'secondary'}>
                {book.availableCount > 0
                  ? t('bookDetail.availableOf', { available: book.availableCount, total: book.quantity })
                  : t('bookDetail.allBorrowed', { total: book.quantity })}
              </Badge>
              {!manageMode && (
                <Button
                  size="sm"
                  disabled={book.availableCount <= 0 || borrow.isPending}
                  onClick={() => borrow.mutate({ bookId })}
                >
                  {borrow.isPending ? t('book.borrowing') : t('book.borrow')}
                </Button>
              )}
            </div>

            {/* Admin: current borrower + due date */}
            {manageMode && book.availableCount < book.quantity && borrower && (
              <div
                className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm"
                data-testid="borrower-info"
              >
                <span className="text-muted-foreground">{t('bookDetail.borrowedBy')}</span>
                <span className="font-medium">{borrower.borrowerName}</span>
                <span className="text-muted-foreground"> ({borrower.borrowerEmail})</span>
                <span className="text-muted-foreground">
                  {t('bookDetail.dueSuffix', { date: new Date(borrower.dueDate).toLocaleDateString() })}
                </span>
              </div>
            )}

            {manageMode && (
              <div className="flex items-center gap-2 pt-1" data-testid="admin-controls">
                <Link
                  to="/books/$bookId/edit"
                  params={{ bookId }}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  {t('common.edit')}
                </Link>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {remove.isPending ? t('common.deleting') : t('common.delete')}
                </Button>
              </div>
            )}

            {book.subjects && book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {book.subjects.map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {book.description && (
              <div className="pt-2">
                <h2 className="mb-1 font-semibold">{t('bookDetail.description')}</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {book.description}
                </p>
              </div>
            )}

            <RawFields raw={book.raw} />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={t('bookDetail.deleteConfirmTitle')}
        description={t('bookDetail.deleteConfirmDesc')}
        confirmLabel={t('common.delete')}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ bookId })}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}


/**
 * Renders EVERY original source field for an imported book (zero-loss
 * passthrough), so columns we don't surface as typed fields still appear.
 * Imported books store raw as { books: Row[], stock: Row|null } (all physical
 * copies for the ISBN + the stock row). Falls back to a flat object or renders
 * nothing when there is no raw data (e.g. app-created books).
 */
function RawFields({ raw }: { raw: unknown }) {
  const { t } = useI18n()
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { books?: Record<string, unknown>[]; stock?: Record<string, unknown> | null }
  const rows: Record<string, unknown>[] = Array.isArray(r.books)
    ? r.books
    : [raw as Record<string, unknown>]
  const entries = (obj: Record<string, unknown>) =>
    Object.entries(obj).filter(([, v]) => v !== '' && v != null)
  if (rows.length === 0) return null

  return (
    <details className="pt-2" data-testid="raw-fields">
      <summary className="cursor-pointer text-sm font-semibold">
        {t('bookDetail.rawFields')}
      </summary>
      <div className="mt-2 space-y-3">
        {rows.map((row, i) => (
          <div key={i}>
            {rows.length > 1 && (
              <p className="text-xs text-muted-foreground">{t('bookDetail.copyN', { n: i + 1 })}</p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
              {entries(row).map(([k, v]) => (
                <RawRow key={k} label={k} value={v} />
              ))}
            </dl>
          </div>
        ))}
        {r.stock && entries(r.stock).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">{t('bookDetail.stock')}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
              {entries(r.stock).map(([k, v]) => (
                <RawRow key={k} label={k} value={v} />
              ))}
            </dl>
          </div>
        )}
      </div>
    </details>
  )
}

function RawRow({ label, value }: { label: string; value: unknown }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line break-words">{String(value)}</dd>
    </>
  )
}
