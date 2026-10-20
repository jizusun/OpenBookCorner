import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { AuditTable } from './AuditTable'
import type { AuditRow } from '@/lib/audit-format'

export const Route = createFileRoute('/_app/admin/activity')({
  pendingComponent: () => <ListPageSkeleton />,
  // Library admins (and super admins) — tenant-scoped activity for THEIR library.
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'library_admin' && context.user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: ActivityPage,
})

function ActivityPage() {
  const { data, isLoading } = useQuery(api.library.audit.queryOptions())
  const rows = (data ?? []) as AuditRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Activity</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>Recent changes in your library.</Trans>
        </p>
      </div>

      <AuditTable rows={rows} loading={isLoading} />
    </div>
  )
}
