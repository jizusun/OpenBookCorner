import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'

const RANGES = [
  { value: 'all', labelKey: 'overdue.range.all' },
  { value: '1-7', labelKey: 'overdue.range.1-7' },
  { value: '8-14', labelKey: 'overdue.range.8-14' },
  { value: '15+', labelKey: 'overdue.range.15+' },
] as const

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
  const { t } = useI18n()

  const { data: items, isLoading } = useQuery(
    trpc.borrowing.listOverdue.queryOptions({ range: active }),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('overdue.title')}</h1>

      <div className="flex flex-wrap gap-2" data-testid="overdue-filters">
        {RANGES.map((r) => (
          <Button
            key={r.value}
            size="sm"
            variant={active === r.value ? 'default' : 'outline'}
            onClick={() => navigate({ search: { range: r.value === 'all' ? undefined : r.value } })}
          >
            {t(r.labelKey)}
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
          title={t('overdue.empty.title')}
          description={t('overdue.empty.description')}
        />
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="overdue-table">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t('overdue.col.book')}</th>
                <th className="p-3">{t('overdue.col.borrower')}</th>
                <th className="p-3">{t('overdue.col.dueDate')}</th>
                <th className="p-3">{t('overdue.col.daysOverdue')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.transactionId} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{t('overdue.byAuthor', { author: item.author })}</div>
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
                    <Badge variant="destructive">{t('overdue.days', { count: item.daysOverdue })}</Badge>
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
