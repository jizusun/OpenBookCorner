import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { myBooks, returnBook } from '@/server/functions/borrowing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_app/my-books')({ component: MyBooksPage })

function MyBooksPage() {
  const myBooksFn = useServerFn(myBooks)
  const returnFn = useServerFn(returnBook)
  const queryClient = useQueryClient()

  const { data: items, isLoading } = useQuery({
    queryKey: ['my-books'],
    queryFn: () => myBooksFn({ data: undefined }),
  })

  const doReturn = useMutation({
    mutationFn: (transactionId: string) => returnFn({ data: { transactionId } }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my-books'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Books</h1>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-muted-foreground">No books currently borrowed.</p>
      )}
      <div className="grid gap-4">
        {items?.map((item) => (
          <Card key={item.transactionId}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <p className="text-sm text-muted-foreground">by {item.author}</p>
              <p className="text-xs text-muted-foreground">
                Due: {new Date(item.dueDate).toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant={item.isOverdue ? 'destructive' : 'default'}>
                  {item.isOverdue ? 'Overdue' : 'Borrowed'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={doReturn.isPending && doReturn.variables === item.transactionId}
                  onClick={() => doReturn.mutate(item.transactionId)}
                >
                  Return
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
