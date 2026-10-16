import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { trpc, trpcClient } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = [
  { value: 'all', label: 'All' },
  { value: '1-7', label: '1–7 days' },
  { value: '8-14', label: '8–14 days' },
  { value: '15+', label: '15+ days' },
] as const

const searchSchema = z.object({
  range: z.enum(['all', '1-7', '8-14', '15+']).optional(),
})

export const Route = createFileRoute('/_app/admin/overdue')({
  validateSearch: searchSchema,
  // Admin-only route (UX guard; the server also enforces admin).
  beforeLoad: async () => {
    const user = await trpcClient.auth.requireMe.query()
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: OverduePage,
})

function OverduePage() {
  const { range } = Route.useSearch()
  const navigate = Route.useNavigate()
  const active = range ?? 'all'

  const { data: items, isLoading } = useQuery(
    trpc.borrowing.listOverdue.queryOptions({ range: active }),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Overdue Books</h1>

      <div className="flex flex-wrap gap-2" data-testid="overdue-filters">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            size="sm"
            variant={active === r.value ? 'default' : 'outline'}
            onClick={() => navigate({ search: { range: r.value === 'all' ? undefined : r.value } })}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2" data-testid="loading-skeleton">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {!isLoading && items && items.length === 0 && (
        <EmptyState
          data-testid="overdue-empty"
          icon="✅"
          title="No overdue books in this range"
          description="Nothing needs chasing right now."
        />
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="overdue-table">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Book</th>
                <th className="p-3">Borrower</th>
                <th className="p-3">Due date</th>
                <th className="p-3">Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.transactionId} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">by {item.author}</div>
                  </td>
                  <td className="p-3">
                    <div>{item.borrowerName}</div>
                    <a
                      href={`mailto:${item.borrowerEmail}`}
                      className="text-xs text-primary underline"
                    >
                      {item.borrowerEmail}
                    </a>
                  </td>
                  <td className="p-3">{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td className="p-3">
                    <Badge variant="destructive">{item.daysOverdue}d</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
