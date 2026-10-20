import { Trans } from '@lingui/react/macro'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatAuditRow, type AuditActionKind, type AuditRow } from '@/lib/audit-format'

export interface AuditTableProps {
  rows: AuditRow[]
  loading: boolean
}

/** Localized action label via <Trans>; unknown actions fall back to the raw string. */
function ActionLabel({ kind, action }: { kind: AuditActionKind; action: string }) {
  switch (kind) {
    case 'impersonation.start':
      return <Trans>Started impersonation</Trans>
    case 'impersonation.stop':
      return <Trans>Stopped impersonation</Trans>
    case 'tenant.create':
      return <Trans>Created tenant</Trans>
    case 'tenant.setActive':
      return <Trans>Activated/deactivated tenant</Trans>
    case 'tenant.update':
      return <Trans>Updated tenant</Trans>
    case 'tenant.delete':
      return <Trans>Deleted tenant</Trans>
    default:
      return <>{action}</>
  }
}

type AuditView = ReturnType<typeof formatAuditRow>

const columns: Column<AuditView>[] = [
  { header: <Trans>Time</Trans>, cell: (v) => <span className="whitespace-nowrap">{v.time}</span>, muted: true },
  {
    header: <Trans>Actor</Trans>,
    cell: (v) => (
      <>
        {v.actorName ?? v.actorUserId}
        {v.isImpersonation && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            <Trans>on behalf of {v.onBehalfOfName ?? v.onBehalfOf}</Trans>
          </Badge>
        )}
      </>
    ),
  },
  {
    header: <Trans>Action</Trans>,
    cell: (v) => (
      <span data-testid="audit-action">
        <ActionLabel kind={v.kind} action={v.action} />
      </span>
    ),
  },
  { header: <Trans>Target</Trans>, cell: (v) => v.targetDisplay, muted: true },
]

/** Read-only quiet table of system audit entries (super-admin console). */
export function AuditTable({ rows, loading }: AuditTableProps) {
  const views = rows.map(formatAuditRow)
  return (
    <DataTable<AuditView>
      rows={views}
      loading={loading}
      columns={columns}
      rowKey={(v) => v.id}
      testId="audit"
      empty={{
        icon: '🗂️',
        title: <Trans>No audit entries yet</Trans>,
        description: <Trans>System actions (tenant changes, impersonation) will appear here.</Trans>,
      }}
    />
  )
}
