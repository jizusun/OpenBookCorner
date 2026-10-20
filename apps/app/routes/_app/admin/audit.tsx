import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { api } from '@/lib/api'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { Pager } from '@/components/ui/Pager'
import { AuditTable } from './AuditTable'
import type { AuditRow } from '@/lib/audit-format'

const PAGE_SIZE = 50

// Known audit actions for the filter dropdown (ADR 0005 coverage).
const ACTIONS = [
  'tenant.create',
  'tenant.update',
  'tenant.delete',
  'tenant.setActive',
  'tenant.addAdmin',
  'member.create',
  'book.add',
  'book.update',
  'book.delete',
  'library.updateSettings',
  'circulation.borrow',
  'circulation.return',
  'impersonation.start',
  'impersonation.stop',
] as const

const searchSchema = z.object({
  tenant: z.string().optional(),
  action: z.string().optional(),
})

export const Route = createFileRoute('/_app/admin/audit')({
  pendingComponent: () => <ListPageSkeleton />,
  validateSearch: searchSchema,
  // Super-admin only (global audit log).
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: AuditPage,
})

function AuditPage() {
  const { tenant, action } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { t } = useLingui()
  const [page, setPage] = useState(1)

  const { data: tenants } = useQuery(api.tenant.list.queryOptions())
  const { data, isLoading } = useQuery(
    api.admin.audit.queryOptions({ libraryId: tenant, action, page, limit: PAGE_SIZE }),
  )
  const rows = (data?.items ?? []) as AuditRow[]
  const total = data?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

  function setFilter(key: 'tenant' | 'action', value: string) {
    setPage(1)
    navigate({ search: (prev) => ({ ...prev, [key]: value || undefined }) })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Audit log</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>All changes across the system (super admin).</Trans>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="audit-filters">
        <select
          className="rounded-md border px-2 py-1"
          data-testid="audit-tenant-filter"
          value={tenant ?? ''}
          onChange={(e) => setFilter('tenant', e.target.value)}
        >
          <option value="">{t`All tenants`}</option>
          {tenants?.map((tn) => (
            <option key={tn.id} value={tn.id}>
              {tn.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border px-2 py-1"
          data-testid="audit-action-filter"
          value={action ?? ''}
          onChange={(e) => setFilter('action', e.target.value)}
        >
          <option value="">{t`All actions`}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {!isLoading && (
          <span className="text-muted-foreground">
            <Trans>{total} entries</Trans>
          </span>
        )}
      </div>

      <AuditTable rows={rows} loading={isLoading} />

      <Pager
        page={page}
        hasMore={hasMore}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        data-testid="audit-pager"
      />
    </div>
  )
}
