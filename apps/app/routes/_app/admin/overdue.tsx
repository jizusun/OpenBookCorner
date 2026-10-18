import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = ['all', '1-7', '8-14', '15+'] as const

function RangeLabel({ range }: { range: (typeof RANGES)[number] }) {
  switch (range) {
    case 'all':
      return <Trans>All</Trans>
    case '1-7':
      return <Trans>1–7 days</Trans>
    case '8-14':
      return <Trans>8–14 days</Trans>
    case '15+':
      return <Trans>15+ days</Trans>
  }
}

const searchSchema = z.object({
  range: z.enum(['all', '1-7', '8-14', '15+']).optional(),
})

export const Route = createFileRoute('/_app/admin/overdue')({
  validateSearch: searchSchema,
  // Admin-only route (UX guard; the server also enforces admin).
  beforeLoad: ({ context }) => {
    const user = context.user
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
    api.borrowing.listOverdue.queryOptions({ range: active }),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <Trans>Overdue Books</Trans>
      </h1>

      <div className="flex flex-wrap gap-2" data-testid="overdue-filters">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={active === r ? 'default' : 'outline'}
            onClick={() => navigate({ search: { range: r === 'all' ? undefined : r } })}
          >
            <RangeLabel range={r} />
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
          title={<Trans>No overdue books in this range</Trans>}
          description={<Trans>Nothing needs chasing right now.</Trans>}
        />
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="overdue-table">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">
                  <Trans>Book</Trans>
                </th>
                <th className="p-3">
                  <Trans>Borrower</Trans>
                </th>
                <th className="p-3">
                  <Trans>Due date</Trans>
                </th>
                <th className="p-3">
                  <Trans>Days overdue</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.transactionId} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <Trans>by {item.author}</Trans>
                    </div>
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
                    <Badge variant="destructive">
                      <Trans>{item.daysOverdue}d</Trans>
                    </Badge>
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
