import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { myBooks, returnBook } from '@/server/functions/borrowing'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { circulationErrorMessage } from '@/lib/errors'
import { useToast } from '@/components/Toast'
import { BookListSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/_app/my-books')({ component: MyBooksPage })

const DAY = 24 * 60 * 60 * 1000

function daysUntil(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / DAY)
}

// Human-friendly due-date urgency.
function dueInfo(dueDate: string): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  const diffDays = daysUntil(dueDate)
  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, variant: 'destructive' }
  if (diffDays === 0) return { label: 'Due today', variant: 'destructive' }
  if (diffDays <= 2) return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, variant: 'secondary' }
  return { label: `Due in ${diffDays} days`, variant: 'default' }
}

type MyBookItem = Awaited<ReturnType<typeof myBooks>>[number]

function MyBooksPage() {
  const myBooksFn = useServerFn(myBooks)
  const returnFn = useServerFn(returnBook)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: items, isLoading, isFetching } = useQuery({
    queryKey: ['my-books'],
    queryFn: () => myBooksFn({ data: undefined }),
    // Always revalidate on mount so a stale/empty snapshot is never shown.
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const doReturn = useMutation({
    mutationFn: (transactionId: string) => returnFn({ data: { transactionId } }),
    // Optimistic: remove the returned book from the list immediately.
    onMutate: async (transactionId: string) => {
      await queryClient.cancelQueries({ queryKey: ['my-books'] })
      const prev = queryClient.getQueryData<MyBookItem[]>(['my-books'])
      if (prev) {
        queryClient.setQueryData<MyBookItem[]>(
          ['my-books'],
          prev.filter((b) => b.transactionId !== transactionId),
        )
      }
      return { prev }
    },
    onSuccess: () => toast.success('Returned. Thanks!'),
    onError: (e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['my-books'], ctx.prev)
      toast.error(circulationErrorMessage(e))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })

  // Due-soon summary line.
  const summary = (() => {
    if (!items || items.length === 0) return null
    const overdue = items.filter((i) => daysUntil(i.dueDate) < 0).length
    const dueSoon = items.filter((i) => {
      const d = daysUntil(i.dueDate)
      return d >= 0 && d <= 2
    }).length
    const parts = [`${items.length} book${items.length === 1 ? '' : 's'} borrowed`]
    if (overdue > 0) parts.push(`${overdue} overdue`)
    if (dueSoon > 0) parts.push(`${dueSoon} due soon`)
    return { text: parts.join(' · '), urgent: overdue > 0 || dueSoon > 0 }
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Books</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/scan"
            className={buttonVariants({ size: 'sm' })}
            data-testid="scan-to-borrow"
          >
            <span aria-hidden className="mr-1">📷</span> Scan to borrow
          </Link>
          <Link to="/books" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Browse catalog
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
          title="You haven't borrowed any books yet."
          description="Scan a book's barcode to borrow it, or browse the catalog."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link to="/scan" className={buttonVariants({ size: 'sm' })}>
                <span aria-hidden className="mr-1">📷</span> Scan to borrow
              </Link>
              <Link
                to="/books"
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                Browse the catalog
              </Link>
            </div>
          }
        />
      )}

      <div className="grid gap-4">
        {items?.map((item) => {
          const due = dueInfo(item.dueDate)
          const pending = doReturn.isPending && doReturn.variables === item.transactionId
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
                    No cover
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
                  <p className="text-sm text-muted-foreground">by {item.author}</p>
                  <p className="text-xs text-muted-foreground">
                    Borrowed {new Date(item.borrowedAt).toLocaleDateString()} · Due{' '}
                    {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <Badge variant={due.variant}>{due.label}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => doReturn.mutate(item.transactionId)}
                    >
                      {pending ? 'Returning…' : 'Return'}
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
