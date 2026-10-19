import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { UsersTable, type AdminUserRow } from './UsersTable'

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
  const [term, setTerm] = useState(q ?? '')

  const { data, isLoading } = useQuery(api.admin.users.queryOptions({ search: q, limit: 50 }))
  const rows = (data?.items ?? []) as AdminUserRow[]
  const total = data?.total ?? 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ search: () => ({ q: term.trim() || undefined }) })
  }

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

      <form onSubmit={submit} className="flex gap-2" data-testid="user-search-form">
        <Input
          placeholder={t`Search by name or email…`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t`Search users`}
        />
        <Button type="submit" variant="outline">
          <Trans>Search</Trans>
        </Button>
      </form>

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
    </div>
  )
}
