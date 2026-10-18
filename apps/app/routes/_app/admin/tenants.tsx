import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'
import { useI18n } from '@/lib/i18n'

export const Route = createFileRoute('/_app/admin/tenants')({
  // Super-admin only.
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: TenantsPage,
})

function TenantsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useI18n()
  const { data: tenants, isLoading } = useQuery(trpc.tenant.list.queryOptions())

  const [name, setName] = useState('')
  const [domains, setDomains] = useState('')

  const create = useMutation({
    ...trpc.tenant.create.mutationOptions(),
    onSuccess: () => {
      toast.success(t('tenants.createdToast'))
      setName('')
      setDomains('')
      queryClient.invalidateQueries({ queryKey: trpc.tenant.list.queryKey() })
    },
    onError: () => toast.error(t('tenants.createError')),
  })

  const toggle = useMutation({
    ...trpc.tenant.setActive.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.tenant.list.queryKey() }),
    onError: () => toast.error(t('tenants.updateError')),
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
        <h1 className="text-2xl font-bold">{t('tenants.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('tenants.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('tenants.create')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" data-testid="create-tenant-form">
            <div className="space-y-2">
              <Label htmlFor="t-name">{t('tenants.name')}</Label>
              <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-domains">{t('tenants.emailDomains')}</Label>
              <Input
                id="t-domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder={t('tenants.emailDomainsPlaceholder')}
                required
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('tenants.creating') : t('tenants.createSubmit')}
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
        <EmptyState icon="🏛️" title={t('tenants.empty.title')} description={t('tenants.empty.description')} />
      )}

      <div className="grid gap-3" data-testid="tenant-list">
        {tenants?.map((tenant) => (
          <Card key={tenant.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{tenant.name}</span>
                  <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                    {tenant.isActive ? t('tenants.active') : t('tenants.inactive')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('tenants.summary', {
                    domains: tenant.emailDomains.join(', '),
                    books: tenant.bookCount,
                    members: tenant.memberCount,
                  })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ libraryId: tenant.id, isActive: !tenant.isActive })}
              >
                {tenant.isActive ? t('tenants.deactivate') : t('tenants.activate')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
