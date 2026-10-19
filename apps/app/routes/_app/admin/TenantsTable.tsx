import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export interface TenantRow {
  id: string
  name: string
  slug: string | null
  isActive: boolean
  bookCount: number
  userCount: number
}

export interface TenantsTableProps {
  rows: TenantRow[]
  loading: boolean
}

/**
 * Quiet, scannable tenant list (super-admin console). Each row shows identity +
 * key facts and drills into the tenant detail page — NO per-row Edit/Deactivate/
 * Delete buttons (those live on the detail page). Follows the console visual
 * rules: a list is a list; secondary/destructive actions move to the detail.
 */
export function TenantsTable({ rows, loading }: TenantsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="tenant-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div data-testid="tenant-empty">
        <EmptyState
          icon="🏛️"
          title={<Trans>No libraries yet</Trans>}
          description={<Trans>Create the first one.</Trans>}
        />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border" data-testid="tenant-table">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">
              <Trans>Name</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Slug</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Status</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Users</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Books</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tn) => (
            <tr key={tn.id} className="border-t hover:bg-accent/40" data-testid={`tenant-row-${tn.id}`}>
              <td className="px-3 py-2 font-medium">
                <Link
                  to="/admin/tenants/$libraryId"
                  params={{ libraryId: tn.id }}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {tn.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {tn.slug ? `/t/${tn.slug}` : '—'}
              </td>
              <td className="px-3 py-2">
                <Badge variant={tn.isActive ? 'default' : 'secondary'}>
                  {tn.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{tn.userCount}</td>
              <td className="px-3 py-2 text-muted-foreground">{tn.bookCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
