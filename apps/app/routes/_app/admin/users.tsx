import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { UsersTable, type AdminUserRow } from './UsersTable'

// Client-side table (ADR 0008): fetch the full set, let the DataTable do
// search / sort / faceted filter / pagination in the browser.
const ALL = 200

export const Route = createFileRoute('/_app/admin/users')({
  pendingComponent: () => <ListPageSkeleton />,
  // Super-admin only (cross-tenant user directory).
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: UsersPage,
})

function UsersPage() {
  const router = useRouter()
  const { user } = Route.useRouteContext()
  const { t } = useLingui()

  const { data, isLoading } = useQuery(api.admin.users.queryOptions({ page: 1, limit: ALL }))
  const rows = (data?.items ?? []) as AdminUserRow[]
  const total = data?.total ?? rows.length
  const shown = rows.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Users</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>All users across every tenant (super admin).</Trans>
        </p>
      </div>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          <Trans>{total} users</Trans>
          {total > rows.length ? (
            <>
              {' · '}
              <span className="text-amber-600 dark:text-amber-500">
                <Trans>showing the first {shown} — refine upstream search to see the rest</Trans>
              </span>
            </>
          ) : null}
        </p>
      )}

      <UsersTable
        rows={rows}
        loading={isLoading}
        viewerRole={user.role}
        viewerId={user.id}
        clearCache={() => queryClient.clear()}
        onImpersonated={() => router.navigate({ to: '/my-books' })}
        searchPlaceholder={t`Search by name or email…`}
        searchAria={t`Search users`}
        roleLabel={t`Role`}
      />
    </div>
  )
}
