import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/DataTable'

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

const columns: Column<TenantRow>[] = [
  {
    header: <Trans>Name</Trans>,
    cell: (tn) => (
      <Link
        to="/admin/tenants/$libraryId"
        params={{ libraryId: tn.id }}
        className="text-primary underline-offset-2 hover:underline"
      >
        {tn.name}
      </Link>
    ),
  },
  { header: <Trans>Slug</Trans>, cell: (tn) => (tn.slug ? `/t/${tn.slug}` : '—'), muted: true },
  {
    header: <Trans>Status</Trans>,
    cell: (tn) => (
      <Badge variant={tn.isActive ? 'default' : 'secondary'}>
        {tn.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
      </Badge>
    ),
  },
  { header: <Trans>Users</Trans>, cell: (tn) => tn.userCount, muted: true },
  { header: <Trans>Books</Trans>, cell: (tn) => tn.bookCount, muted: true },
]

/**
 * Quiet, scannable tenant list (super-admin console). Each row drills into the
 * tenant detail page; no per-row action buttons (those live on the detail page).
 */
export function TenantsTable({ rows, loading }: TenantsTableProps) {
  return (
    <DataTable<TenantRow>
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(tn) => tn.id}
      rowTestId={(tn) => `tenant-row-${tn.id}`}
      testId="tenant"
      skeletonRows={2}
      empty={{ icon: '🏛️', title: <Trans>No libraries yet</Trans>, description: <Trans>Create the first one.</Trans> }}
    />
  )
}
