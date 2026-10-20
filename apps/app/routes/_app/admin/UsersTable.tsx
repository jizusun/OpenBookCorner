import { Trans } from '@lingui/react/macro'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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

/** Role label via real <Trans> (a macro `t` passed into a plain fn doesn't get
 *  extracted/translated — that caused an empty Role column). */
function RoleLabel({ role }: { role: string }) {
  if (role === 'super_admin') return <Trans>Super admin</Trans>
  if (role === 'library_admin') return <Trans>Admin</Trans>
  if (role === 'library_reader') return <Trans>Reader</Trans>
  return <>{role || '—'}</>
}

/**
 * Quiet, scannable table of ALL users across tenants (super-admin console).
 * Each row shows identity + tenant + role and a SINGLE primary action
 * ("Sign in as them"), shown only where impersonation is allowed. Follows the
 * console visual rules (no cramped multi-button rows), with loading/empty states.
 */
export function UsersTable({
  rows,
  loading,
  viewerRole,
  viewerId,
  onImpersonated,
  clearCache,
}: UsersTableProps) {

  if (loading) {
    return (
      <div className="space-y-2" data-testid="users-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div data-testid="users-empty">
        <EmptyState
          icon="👤"
          title={<Trans>No users found</Trans>}
          description={<Trans>Try a different search.</Trans>}
        />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border" data-testid="users-table">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">
              <Trans>Name</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Email</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Tenant</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <Trans>Role</Trans>
            </th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">
                <Trans>Actions</Trans>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              className="border-t hover:bg-accent/40"
              data-testid={`user-row-${u.id}`}
            >
              <td className="px-3 py-2 font-medium">{u.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
              <td className="px-3 py-2">{u.libraryName ?? '—'}</td>
              <td className="px-3 py-2">
                <Badge variant="outline"><RoleLabel role={u.role} /></Badge>
              </td>
              <td className="px-3 py-2">
                {canImpersonateUser(viewerRole, viewerId, { id: u.id, role: u.role }) && (
                  <MemberImpersonateButton
                    viewerRole={viewerRole}
                    viewerId={viewerId}
                    memberUserId={u.id}
                    onImpersonated={onImpersonated}
                    clearCache={clearCache}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
