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
  searchPlaceholder?: string
  searchAria?: string
  roleLabel?: string
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
export function UsersTable({ rows, loading, viewerRole, viewerId, onImpersonated, clearCache, searchPlaceholder, searchAria, roleLabel }: UsersTableProps) {
  const columns: Column<AdminUserRow>[] = [
    { id: 'name', header: <Trans>Name</Trans>, cell: (u) => u.name, sortable: true, sortValue: (u) => u.name },
    { id: 'email', header: <Trans>Email</Trans>, cell: (u) => u.email, muted: true, sortable: true, sortValue: (u) => u.email },
    { id: 'tenant', header: <Trans>Tenant</Trans>, cell: (u) => u.libraryName ?? '—', sortable: true, sortValue: (u) => u.libraryName },
    { id: 'role', header: <Trans>Role</Trans>, cell: (u) => <Badge variant="outline"><RoleLabel role={u.role} /></Badge> },
    {
      id: 'actions',
      header: <Trans>Actions</Trans>,
      srHeader: true,
      hideable: false,
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
      toolbar={{
        search: {
          keys: [(u) => u.name, (u) => u.email, (u) => u.libraryName],
          placeholder: searchPlaceholder,
          ariaLabel: searchAria,
        },
        faceted: [
          {
            columnId: 'role',
            label: roleLabel ?? 'Role',
            value: (u) => u.role,
            options: [
              { value: 'super_admin', label: <RoleLabel role="super_admin" /> },
              { value: 'library_admin', label: <RoleLabel role="library_admin" /> },
              { value: 'library_reader', label: <RoleLabel role="library_reader" /> },
            ],
          },
        ],
      }}
      enableColumnVisibility
      enablePagination
      pageSize={20}
      empty={{ icon: '👤', title: <Trans>No users found</Trans>, description: <Trans>Try a different search.</Trans> }}
    />
  )
}
