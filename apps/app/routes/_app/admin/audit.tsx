import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { AuditTable } from './AuditTable'
import type { AuditRow } from '@/lib/audit-format'

export const Route = createFileRoute('/_app/admin/audit')({
  pendingComponent: () => <ListPageSkeleton />,
  // Super-admin only (system-level audit log).
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: AuditPage,
})

function AuditPage() {
  const { data, isLoading } = useQuery(api.tenant.audit.queryOptions())
  const rows = (data ?? []) as AuditRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Audit log</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>System-level actions across all tenants (super admin).</Trans>
        </p>
      </div>

      <AuditTable rows={rows} loading={isLoading} />
    </div>
  )
}
