import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { myBooks, returnBook } from '@/server/functions/borrowing'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { circulationErrorMessage } from '@/lib/errors'

export const Route = createFileRoute('/_app/my-books')({ component: MyBooksPage })

// Human-friendly due-date urgency.
function dueInfo(dueDate: string): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  const DAY = 24 * 60 * 60 * 1000
  const diffDays = Math.ceil((new Date(dueDate).getTime() - Date.now()) / DAY)
  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, variant: 'destructive' }
  if (diffDays === 0) return { label: 'Due today', variant: 'destructive' }
  if (diffDays <= 2) return { label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`, variant: 'secondary' }
  return { label: `Due in ${diffDays} days`, variant: 'default' }
}

function MyBooksPage() {
  const myBooksFn = useServerFn(myBooks)
  const returnFn = useServerFn(returnBook)
  const queryClient = useQueryClient()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ['my-books'],
    queryFn: () => myBooksFn({ data: undefined }),
  })

  const doReturn = useMutation({
    mutationFn: (transactionId: string) => returnFn({ data: { transactionId } }),
    onSuccess: () => setMsg({ kind: 'ok', text: 'Returned. Thanks!' }),
    onError: (e) => setMsg({ kind: 'err', text: circulationErrorMessage(e) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Books</h1>

      {msg && (
        <div
          data-testid="return-msg"
          className={
            msg.kind === 'ok'
              ? 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
              : 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          }
        >
          {msg.text}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && items && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-muted-foreground">You haven't borrowed any books yet.</p>
            <Link to="/books" className={buttonVariants({ size: 'sm' })}>
              Browse the catalog
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items?.map((item) => {
          const due = dueInfo(item.dueDate)
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
                      disabled={doReturn.isPending && doReturn.variables === item.transactionId}
                      onClick={() => {
                        setMsg(null)
                        doReturn.mutate(item.transactionId)
                      }}
                    >
                      {doReturn.isPending && doReturn.variables === item.transactionId ? 'Returning…' : 'Return'}
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
