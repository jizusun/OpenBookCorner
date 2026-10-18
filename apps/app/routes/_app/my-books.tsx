import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { useI18n, type TranslateFn } from '@/lib/i18n'
import { BookListSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/_app/my-books')({ component: MyBooksPage })

const DAY = 24 * 60 * 60 * 1000

type Translate = TranslateFn

function daysUntil(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / DAY)
}

function dueInfo(
  dueDate: string,
  t: Translate,
): {
  label: string
  variant: 'default' | 'secondary' | 'destructive'
} {
  const diffDays = daysUntil(dueDate)
  if (diffDays < 0) {
    const n = Math.abs(diffDays)
    return {
      label: n === 1 ? t('myBooks.due.overdueOne') : t('myBooks.due.overdueMany', { count: n }),
      variant: 'destructive',
    }
  }
  if (diffDays === 0) return { label: t('myBooks.due.today'), variant: 'destructive' }
  if (diffDays <= 2)
    return {
      label: diffDays === 1 ? t('myBooks.due.inOne') : t('myBooks.due.inMany', { count: diffDays }),
      variant: 'secondary',
    }
  return { label: t('myBooks.due.inMany', { count: diffDays }), variant: 'default' }
}

type MyBookItem = Awaited<ReturnType<typeof trpcClient.borrowing.myBooks.query>>[number]

function MyBooksPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()
  const myBooksKey = trpc.borrowing.myBooks.queryKey()

  const { data: items, isLoading, isFetching } = useQuery({
    ...trpc.borrowing.myBooks.queryOptions(),
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const doReturn = useMutation({
    ...trpc.borrowing.return.mutationOptions(),
    onMutate: async (vars: { transactionId: string }) => {
      await queryClient.cancelQueries({ queryKey: myBooksKey })
      const prev = queryClient.getQueryData<MyBookItem[]>(myBooksKey)
      if (prev) {
        queryClient.setQueryData<MyBookItem[]>(
          myBooksKey,
          prev.filter((b) => b.transactionId !== vars.transactionId),
        )
      }
      return { prev }
    },
    onSuccess: () => toast.success(t('myBooks.returned')),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(myBooksKey, ctx.prev)
      toast.error(circulationErrorMessage(e))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: myBooksKey })
      queryClient.invalidateQueries({ queryKey: trpc.book.list.queryKey() })
    },
  })

  const summary = (() => {
    if (!items || items.length === 0) return null
    const overdue = items.filter((i) => daysUntil(i.dueDate) < 0).length
    const dueSoon = items.filter((i) => {
      const d = daysUntil(i.dueDate)
      return d >= 0 && d <= 2
    }).length
    const parts = [t('myBooks.summary.borrowed', { count: items.length })]
    if (overdue > 0) parts.push(t('myBooks.summary.overdue', { count: overdue }))
    if (dueSoon > 0) parts.push(t('myBooks.summary.dueSoon', { count: dueSoon }))
    return { text: parts.join(' · '), urgent: overdue > 0 || dueSoon > 0 }
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('myBooks.title')}</h1>
        <div className="flex items-center gap-2">
          <Link to="/scan" className={buttonVariants({ size: 'sm' })} data-testid="scan-to-borrow">
            <span aria-hidden className="mr-1">📷</span> {t('myBooks.scanToBorrow')}
          </Link>
          <Link to="/books" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            {t('myBooks.browseCatalog')}
          </Link>
        </div>
      </div>

      {summary && (
        <p
          data-testid="my-books-summary"
          className={`text-sm ${summary.urgent ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
        >
          {summary.text}
        </p>
      )}

      {(isLoading || (isFetching && (!items || items.length === 0))) && (
        <BookListSkeleton count={3} />
      )}

      {!isLoading && !isFetching && items && items.length === 0 && (
        <EmptyState
          icon="📖"
          title={t('myBooks.empty.title')}
          description={t('myBooks.empty.description')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link to="/scan" className={buttonVariants({ size: 'sm' })}>
                <span aria-hidden className="mr-1">📷</span> {t('myBooks.scanToBorrow')}
              </Link>
              <Link to="/books" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                {t('myBooks.browseCatalog')}
              </Link>
            </div>
          }
        />
      )}

      <div className="grid gap-4">
        {items?.map((item) => {
          const due = dueInfo(item.dueDate, t)
          const pending =
            doReturn.isPending && doReturn.variables?.transactionId === item.transactionId
          return (
            <Card key={item.transactionId}>
              <CardContent className="flex gap-4 p-4">
                {item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt={`Cover of ${item.title}`}
                    className="h-24 w-16 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                    {t('myBooks.noCover')}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    to="/books/$bookId"
                    params={{ bookId: item.bookId }}
                    className="font-semibold hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {t('myBooks.byAuthor', { author: item.author })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('myBooks.borrowedOn', { date: new Date(item.borrowedAt).toLocaleDateString() })} ·{' '}
                    {t('myBooks.dueOn', { date: new Date(item.dueDate).toLocaleDateString() })}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <Badge variant={due.variant}>{due.label}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => doReturn.mutate({ transactionId: item.transactionId })}
                    >
                      {pending ? t('myBooks.returning') : t('myBooks.return')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
