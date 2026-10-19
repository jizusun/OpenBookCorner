import { Trans } from '@lingui/react/macro'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAuditRow, type AuditActionKind, type AuditRow } from '@/lib/audit-format'

export interface AuditTableProps {
  rows: AuditRow[]
  loading: boolean
}

/** Localized action label. Uses real <Trans> so the extractor sees every msgid;
 *  unknown actions fall back to the raw action string. */
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

/**
 * Read-only "quiet table" of system audit entries (super-admin console).
 * Follows the console visual rules: a scannable table, muted secondary text,
 * no per-row action buttons, with explicit loading + empty states.
 */
export function AuditTable({ rows, loading }: AuditTableProps) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="audit-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div data-testid="audit-empty">
        <EmptyState
          icon="🗂️"
          title={<Trans>No audit entries yet</Trans>}
          description={<Trans>System actions (tenant changes, impersonation) will appear here.</Trans>}
        />
      </div>
    )
  }

  const views = rows.map(formatAuditRow)

  return (
    <div className="overflow-x-auto rounded-md border" data-testid="audit-table">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">
              <Trans>Time</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Actor</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Action</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Target</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.id} className="border-t hover:bg-accent/40">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{v.time}</td>
              <td className="px-3 py-2">
                {v.actorUserId}
                {v.isImpersonation && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    <Trans>on behalf of {v.onBehalfOf}</Trans>
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2" data-testid="audit-action">
                <ActionLabel kind={v.kind} action={v.action} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">{v.targetDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
