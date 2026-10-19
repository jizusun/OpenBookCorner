import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AuditTable } from './AuditTable'
import type { AuditRow } from '@/lib/audit-format'

export const Route = createFileRoute('/_app/admin/overview')({
  pendingComponent: () => <Skeleton className="h-40 w-full" />,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: OverviewPage,
})

function StatCard({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

function OverviewPage() {
  const { data, isLoading } = useQuery(api.admin.overview.queryOptions())

  if (isLoading || !data) return <Skeleton className="h-40 w-full" />

  const recent = (data.recentAudit ?? []) as AuditRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Overview</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>System-wide snapshot (super admin).</Trans>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={<Trans>Tenants</Trans>} value={data.counts.tenants} />
        <StatCard label={<Trans>Users</Trans>} value={data.counts.users} />
        <StatCard label={<Trans>Books</Trans>} value={data.counts.books} />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            <Trans>Recent activity</Trans>
          </h2>
          <Link to="/admin/audit" className="text-sm text-primary hover:underline">
            <Trans>View all →</Trans>
          </Link>
        </div>
        <AuditTable rows={recent} loading={false} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          <Trans>Tenants</Trans>
        </h2>
        <div className="grid gap-2" data-testid="overview-tenants">
          {data.tenants.map((tn) => (
            <Link
              key={tn.id}
              to="/admin/tenants/$libraryId"
              params={{ libraryId: tn.id }}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent/40"
            >
              <span className="flex items-center gap-2 font-medium">
                {tn.name}
                <Badge variant={tn.isActive ? 'default' : 'secondary'}>
                  {tn.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
                </Badge>
              </span>
              <span className="text-muted-foreground">
                <Trans>
                  {tn.userCount} users · {tn.bookCount} books
                </Trans>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
