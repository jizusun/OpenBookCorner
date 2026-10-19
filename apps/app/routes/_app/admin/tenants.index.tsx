import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'
import { TenantsTable, type TenantRow } from './TenantsTable'

export const Route = createFileRoute('/_app/admin/tenants/')({
  pendingComponent: () => <ListPageSkeleton />,
  component: TenantsIndexPage,
})

function TenantsIndexPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: tenants, isLoading } = useQuery(api.tenant.list.queryOptions())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [domains, setDomains] = useState('')

  const create = useMutation({
    ...api.tenant.create.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Library created.`)
      setName('')
      setDomains('')
      setDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: api.tenant.list.queryKey() })
    },
    onError: () => toast.error(t`Could not create the library.`),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const list = domains.split(',').map((d) => d.trim()).filter(Boolean)
    if (!name.trim() || list.length === 0) return
    create.mutate({ name: name.trim(), emailDomains: list })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <Trans>Tenants</Trans>
          </h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Manage libraries across the system (super admin).</Trans>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="create-tenant-open">
          <Trans>+ Create tenant</Trans>
        </Button>
      </div>

      <TenantsTable rows={(tenants ?? []) as TenantRow[]} loading={isLoading} />

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ariaLabel={t`Create a library`}
        data-testid="create-tenant-dialog"
      >
        <form onSubmit={submit} className="space-y-4" data-testid="create-tenant-form">
          <h2 className="text-lg font-semibold">
            <Trans>Create a library</Trans>
          </h2>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Trans>Creating…</Trans> : <Trans>Create library</Trans>}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
