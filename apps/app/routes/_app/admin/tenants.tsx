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
        {tenants?.map((tenant) => (
          <Card key={tenant.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{tenant.name}</span>
                  <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                    {tenant.isActive ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  <Trans>
                    {tenant.emailDomains.join(', ')} · {tenant.bookCount} books ·{' '}
                    {tenant.memberCount} members
                  </Trans>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ libraryId: tenant.id, isActive: !tenant.isActive })}
              >
                {tenant.isActive ? <Trans>Deactivate</Trans> : <Trans>Activate</Trans>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
