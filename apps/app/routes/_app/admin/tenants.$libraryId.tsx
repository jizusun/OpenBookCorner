import { createFileRoute, redirect, useRouter, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { MemberImpersonateButton } from './MemberImpersonateButton'

export const Route = createFileRoute('/_app/admin/tenants/$libraryId')({
  pendingComponent: () => <Skeleton className="h-40 w-full" />,
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: TenantDetailPage,
})

function TenantDetailPage() {
  const { libraryId } = Route.useParams()
  const router = useRouter()
  const { user } = Route.useRouteContext()
  const { t } = useLingui()

  const { data: tenant, isLoading } = useQuery(api.tenant.get.queryOptions({ id: libraryId }))
  const { data: membersData, isLoading: membersLoading } = useQuery(
    api.tenant.members.queryOptions({ id: libraryId, limit: 100 }),
  )
  const members = membersData?.items ?? []

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!tenant) {
    return (
      <EmptyState
        icon="🏛️"
        title={<Trans>Tenant not found</Trans>}
        description={<Link to="/admin/tenants" className="text-primary underline"><Trans>Back to tenants</Trans></Link>}
      />
    )
  }

  const loginUrl = tenant.slug ? `${window.location.origin}/t/${tenant.slug}/login` : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/admin/tenants" className="text-sm text-muted-foreground hover:underline">
          <Trans>← Back to tenants</Trans>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
            {tenant.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
          </Badge>
          {tenant.slug && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/t/{tenant.slug}</code>
          )}
        </div>
      </div>

      {/* Overview */}
      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          <Trans>Overview</Trans>
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground"><Trans>Email domains</Trans></dt>
            <dd>{tenant.emailDomains.join(', ')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground"><Trans>Members</Trans></dt>
            <dd>{tenant.memberCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground"><Trans>Books</Trans></dt>
            <dd>{tenant.bookCount}</dd>
          </div>
          {loginUrl && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground"><Trans>Login link</Trans></dt>
              <dd className="truncate">
                <a href={loginUrl} className="text-primary hover:underline">{loginUrl}</a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Members */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          <Trans>Members</Trans>
        </h2>
        {membersLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : members.length === 0 ? (
          <EmptyState icon="👥" title={<Trans>No members</Trans>} />
        ) : (
          <div className="overflow-x-auto rounded-md border" data-testid="tenant-members-table">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium"><Trans>Name</Trans></th>
                  <th className="px-3 py-2 font-medium"><Trans>Role</Trans></th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only"><Trans>Actions</Trans></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-accent/40">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2">
                      {m.role === 'library_admin' ? t`Admin` : t`Reader`}
                    </td>
                    <td className="px-3 py-2">
                      <MemberImpersonateButton
                        viewerRole={user.role}
                        viewerId={user.id}
                        memberUserId={m.userId}
                        clearCache={() => queryClient.clear()}
                        onImpersonated={() => router.navigate({ to: '/my-books' })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
