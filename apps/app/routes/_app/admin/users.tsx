import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/ui/SearchBar'
import { Pager } from '@/components/ui/Pager'
import { UsersTable, type AdminUserRow } from './UsersTable'

const PAGE_SIZE = 50
const searchSchema = z.object({ q: z.string().optional() })

export const Route = createFileRoute('/_app/admin/users')({
  pendingComponent: () => <ListPageSkeleton />,
  validateSearch: searchSchema,
  // Super-admin only (cross-tenant user directory).
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: UsersPage,
})

function UsersPage() {
  const { q } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const { user } = Route.useRouteContext()
  const { t } = useLingui()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(api.admin.users.queryOptions({ search: q, page, limit: PAGE_SIZE }))
  const rows = (data?.items ?? []) as AdminUserRow[]
  const total = data?.total ?? 0
  const hasMore = page * PAGE_SIZE < total

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

      <SearchBar
        initial={q ?? ''}
        placeholder={t`Search by name or email…`}
        ariaLabel={t`Search users`}
        data-testid="user-search-form"
        onSearch={(term) => {
          setPage(1)
          navigate({ search: () => ({ q: term || undefined }) })
        }}
      />

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          <Trans>{total} users</Trans>
        </p>
      )}

      <UsersTable
        rows={rows}
        loading={isLoading}
        viewerRole={user.role}
        viewerId={user.id}
        clearCache={() => queryClient.clear()}
        onImpersonated={() => router.navigate({ to: '/my-books' })}
      />

      <Pager
        page={page}
        hasMore={hasMore}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        data-testid="users-pager"
      />
    </div>
  )
}
