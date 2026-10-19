import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton, ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/tenants')({
  pendingComponent: () => <ListPageSkeleton />,
  // Super-admin only.
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: TenantsPage,
})

function TenantsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: tenants, isLoading } = useQuery(api.tenant.list.queryOptions())

  const [name, setName] = useState('')
  const [domains, setDomains] = useState('')

  const create = useMutation({
    ...api.tenant.create.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Library created.`)
      setName('')
      setDomains('')
      queryClient.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
    },
    onError: () => toast.error(t`Could not create the library.`),
  })

  const toggle = useMutation({
    ...api.tenant.setActive.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: api.tenant.list.queryKey() }),
    onError: () => toast.error(t`Could not update the library.`),
  })

  // Inline edit + delete state.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const update = useMutation({
    ...api.tenant.update.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Library updated.`)
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
    },
    onError: (e: Error & { status?: number }) =>
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
      setDeletingId(null)
      queryClient.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
    },
    onError: (e: Error & { status?: number }) => {
      setDeletingId(null)
      toast.error(
        e.message === 'LIBRARY_NOT_EMPTY'
          ? t`Cannot delete a library that still has members or books.`
          : t`Could not delete the library.`,
      )
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const list = domains
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    if (!name.trim() || list.length === 0) return
    create.mutate({ name: name.trim(), emailDomains: list })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Tenants</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>Manage libraries across the system (super admin).</Trans>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Create a library</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" data-testid="create-tenant-form">
            <div className="space-y-2">
              <Label htmlFor="t-name">
                <Trans>Library name</Trans>
              </Label>
              <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-domains">
                <Trans>Email domains (comma-separated)</Trans>
              </Label>
              <Input
                id="t-domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder={t`@acme.com, @acme.io`}
                required
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Trans>Creating…</Trans> : <Trans>Create library</Trans>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2" data-testid="loading-skeleton">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && tenants && tenants.length === 0 && (
        <EmptyState
          icon="🏛️"
          title={<Trans>No libraries yet</Trans>}
          description={<Trans>Create the first one above.</Trans>}
        />
      )}

      <div className="grid gap-3" data-testid="tenant-list">
        {tenants?.map((tenant) => {
          const loginPath = tenant.slug ? `/t/${tenant.slug}/login` : null
          const loginUrl = loginPath ? `${window.location.origin}${loginPath}` : null
          const editing = editingId === tenant.id
          return (
            <Card key={tenant.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{tenant.name}</span>
                      <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                        {tenant.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
                      </Badge>
                      {tenant.slug && (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          /t/{tenant.slug}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tenant.emailDomains.join(', ')} · {tenant.bookCount} books ·{' '}
                      {tenant.memberCount} members
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(editing ? null : tenant.id)}>
                      {editing ? <Trans>Cancel</Trans> : <Trans>Edit</Trans>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ libraryId: tenant.id, isActive: !tenant.isActive })}
                    >
                      {tenant.isActive ? <Trans>Deactivate</Trans> : <Trans>Activate</Trans>}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeletingId(tenant.id)}>
                      <Trans>Delete</Trans>
                    </Button>
                  </div>
                </div>

                {/* Copyable login link for this tenant. */}
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
              </CardContent>

              <ConfirmDialog
                open={deletingId === tenant.id}
                title={t`Delete ${tenant.name}?`}
                confirmLabel={t`Delete`}
                onConfirm={() => remove.mutate({ id: tenant.id })}
                onCancel={() => setDeletingId(null)}
              />
            </Card>
          )
        })}
      </div>
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
