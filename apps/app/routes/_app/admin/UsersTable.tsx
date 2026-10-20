import { Trans } from '@lingui/react/macro'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { MemberImpersonateButton } from './MemberImpersonateButton'
import { canImpersonateUser } from '@/lib/impersonation'

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string
  libraryId: string | null
  libraryName: string | null
}

export interface UsersTableProps {
  rows: AdminUserRow[]
  loading: boolean
  viewerRole: string | null | undefined
  viewerId: string
  onImpersonated: () => void | Promise<void>
  clearCache: () => void
}

/** Role label via real <Trans> (a macro `t` in a plain fn would render empty). */
function RoleLabel({ role }: { role: string }) {
  if (role === 'super_admin') return <Trans>Super admin</Trans>
  if (role === 'library_admin') return <Trans>Admin</Trans>
  if (role === 'library_reader') return <Trans>Reader</Trans>
  return <>{role || '—'}</>
}

/**
 * Quiet, scannable table of ALL users across tenants (super-admin console).
 * One primary action per row ("Sign in as them"), only where impersonation is
 * allowed (super admin, not self, target is a reader).
 */
export function UsersTable({ rows, loading, viewerRole, viewerId, onImpersonated, clearCache }: UsersTableProps) {
  const columns: Column<AdminUserRow>[] = [
    { header: <Trans>Name</Trans>, cell: (u) => u.name },
    { header: <Trans>Email</Trans>, cell: (u) => u.email, muted: true },
    { header: <Trans>Tenant</Trans>, cell: (u) => u.libraryName ?? '—' },
    { header: <Trans>Role</Trans>, cell: (u) => <Badge variant="outline"><RoleLabel role={u.role} /></Badge> },
    {
      header: <Trans>Actions</Trans>,
      srHeader: true,
      cell: (u) =>
        canImpersonateUser(viewerRole, viewerId, { id: u.id, role: u.role }) ? (
          <MemberImpersonateButton
            viewerRole={viewerRole}
            viewerId={viewerId}
            memberUserId={u.id}
            onImpersonated={onImpersonated}
            clearCache={clearCache}
          />
        ) : null,
    },
  ]

  return (
    <DataTable<AdminUserRow>
      rows={rows}
      loading={loading}
      columns={columns}
      rowKey={(u) => u.id}
      rowTestId={(u) => `user-row-${u.id}`}
      testId="users"
      empty={{ icon: '👤', title: <Trans>No users found</Trans>, description: <Trans>Try a different search.</Trans> }}
    />
  )
}
