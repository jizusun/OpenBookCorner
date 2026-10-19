import { useState } from 'react'
import { createFileRoute, redirect, useRouter, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { useToast } from '@/components/Toast'
import { MemberImpersonateButton } from './MemberImpersonateButton'

export const Route = createFileRoute('/_app/admin/tenants/$libraryId')({
  pendingComponent: () => <Skeleton className="h-40 w-full" />,
  component: TenantDetailPage,
})

function TenantDetailPage() {
  const { libraryId } = Route.useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = Route.useRouteContext()
  const { t } = useLingui()

  const { data: tenant, isLoading } = useQuery(api.tenant.get.queryOptions({ id: libraryId }))
  const { data: membersData, isLoading: membersLoading } = useQuery(
    api.tenant.members.queryOptions({ id: libraryId, limit: 100 }),
  )
  const members = membersData?.items ?? []

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: api.tenant.get.queryKey({ id: libraryId }) })
    qc.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
  }

  const toggle = useMutation({
    ...api.tenant.setActive.mutationOptions(),
    onSuccess: invalidate,
    onError: () => toast.error(t`Could not update the library.`),
  })
  const update = useMutation({
    ...api.tenant.update.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Library updated.`)
      setEditing(false)
      invalidate()
    },
    onError: (e: Error) =>
      toast.error(
        e.message === 'SLUG_TAKEN'
          ? t`That slug is already taken.`
          : e.message === 'INVALID_SLUG'
            ? t`That slug is not valid (use lowercase letters, numbers, hyphens).`
            : t`Could not update the library.`,
      ),
  })
  const remove = useMutation({
    ...api.tenant.remove.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Library deleted.`)
      qc.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
      router.navigate({ to: '/admin/tenants' })
    },
    onError: (e: Error) => {
      setDeleting(false)
      toast.error(
        e.message === 'LIBRARY_NOT_EMPTY'
          ? t`Cannot delete a library that still has members or books.`
          : t`Could not delete the library.`,
      )
    },
  })

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

      {/* Overview + everyday actions */}
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            <Trans>Overview</Trans>
          </h2>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} data-testid="tenant-edit-toggle">
            {editing ? <Trans>Cancel</Trans> : <Trans>Edit</Trans>}
          </Button>
        </div>
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
        </dl>
        {loginUrl && (
          <div className="flex items-center gap-2" data-testid="tenant-login-link">
            <Input readOnly value={loginUrl} className="h-8 text-xs" aria-label={t`Tenant login link`} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(loginUrl)
                toast.success(t`Login link copied.`)
              }}
            >
              <Trans>Copy link</Trans>
            </Button>
          </div>
        )}
        {editing && (
          <TenantEditForm
            tenant={tenant}
            pending={update.isPending}
            onSave={(fields) => update.mutate({ id: tenant.id, ...fields })}
          />
        )}
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

      {/* Danger zone */}
      <section className="space-y-3 rounded-md border border-destructive/40 p-4" data-testid="tenant-danger-zone">
        <h2 className="text-sm font-semibold text-destructive">
          <Trans>Danger zone</Trans>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate({ libraryId: tenant.id, isActive: !tenant.isActive })}
          >
            {tenant.isActive ? <Trans>Deactivate</Trans> : <Trans>Activate</Trans>}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleting(true)}>
            <Trans>Delete tenant</Trans>
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={deleting}
        title={t`Delete ${tenant.name}?`}
        confirmLabel={t`Delete`}
        destructive
        onConfirm={() => remove.mutate({ id: tenant.id })}
        onCancel={() => setDeleting(false)}
      />
    </div>
  )
}

/** Inline edit form for a tenant's name / domains / slug / branding. */
function TenantEditForm({
  tenant,
  pending,
  onSave,
}: {
  tenant: { name: string; slug: string | null; emailDomains: string[]; brandColor: string | null; loginWelcome: string | null }
  pending: boolean
  onSave: (fields: {
    name: string
    emailDomains: string[]
    slug?: string
    brandColor: string | null
    loginWelcome: string | null
  }) => void
}) {
  const { t } = useLingui()
  const [name, setName] = useState(tenant.name)
  const [slug, setSlug] = useState(tenant.slug ?? '')
  const [domains, setDomains] = useState(tenant.emailDomains.join(', '))
  const [brandColor, setBrandColor] = useState(tenant.brandColor ?? '')
  const [loginWelcome, setLoginWelcome] = useState(tenant.loginWelcome ?? '')

  function save(e: React.FormEvent) {
    e.preventDefault()
    const list = domains.split(',').map((d) => d.trim()).filter(Boolean)
    if (!name.trim() || list.length === 0) return
    onSave({
      name: name.trim(),
      emailDomains: list,
      slug: slug.trim() || undefined,
      brandColor: brandColor.trim() || null,
      loginWelcome: loginWelcome.trim() || null,
    })
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2" data-testid="tenant-edit-form">
      <div className="space-y-1">
        <Label><Trans>Name</Trans></Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label><Trans>Slug</Trans></Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme" />
      </div>
      <div className="space-y-1">
        <Label><Trans>Email domains</Trans></Label>
        <Input value={domains} onChange={(e) => setDomains(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label><Trans>Brand color</Trans></Label>
        <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#0a6ed1" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label><Trans>Login welcome</Trans></Label>
        <Input value={loginWelcome} onChange={(e) => setLoginWelcome(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Trans>Saving…</Trans> : <Trans>Save changes</Trans>}
        </Button>
      </div>
    </form>
  )
}
