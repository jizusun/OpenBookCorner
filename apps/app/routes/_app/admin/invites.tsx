import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { Copy, Trash2, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_app/admin/invites')({
  pendingComponent: () => <ListPageSkeleton />,
  beforeLoad: ({ context }) => {
    const { role } = context.user
    if (role !== 'library_admin' && role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: InvitesPage,
})

function InvitesPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: invites = [], isLoading } = useQuery(api.invite.adminList.queryOptions())
  const [open, setOpen] = useState(false)
  const [maxUses, setMaxUses] = useState('')
  const [expireDays, setExpireDays] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(true)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invite', 'adminList'] })

  const create = useMutation({
    ...api.invite.create.mutationOptions(),
    onSuccess: () => { toast.success(t`Invite link created.`); invalidate(); setOpen(false) },
  })
  const revoke = useMutation({
    ...api.invite.revoke.mutationOptions(),
    onSuccess: () => { toast.success(t`Invite link revoked.`); invalidate() },
  })

  function inviteUrl(token: string) {
    return `${window.location.origin}/join/${token}`
  }

  function copy(token: string) {
    void navigator.clipboard?.writeText(inviteUrl(token))
    toast.success(t`Invite link copied.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold"><Trans>Invite links</Trans></h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Share these links so people can request to join the library.</Trans>
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="create-invite-open">
          <Plus className="size-4" /><Trans>Create link</Trans>
        </Button>
      </div>

      {isLoading && <ListPageSkeleton />}

      {!isLoading && invites.length === 0 && (
        <EmptyState icon="🔗" title={<Trans>No invite links</Trans>}
          description={<Trans>Create a link to share with prospective members.</Trans>} />
      )}

      {!isLoading && invites.length > 0 && (
        <div className="space-y-2">
          {invites.map((inv) => (
            <Card key={inv.id} data-testid={`invite-${inv.id}`}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                  {inviteUrl(inv.token)}
                </code>
                <div className="flex items-center gap-2">
                  {inv.revoked && <Badge variant="destructive"><Trans>Revoked</Trans></Badge>}
                  {!inv.revoked && inv.requiresApproval && <Badge variant="outline"><Trans>Needs approval</Trans></Badge>}
                  {!inv.revoked && !inv.requiresApproval && <Badge><Trans>Auto-join</Trans></Badge>}
                  <span className="text-xs text-muted-foreground">{inv.usedCount}{inv.maxUses ? `/${inv.maxUses}` : ''} <Trans>uses</Trans></span>
                  <Button size="sm" variant="ghost" onClick={() => copy(inv.token)} disabled={inv.revoked}>
                    <Copy className="size-4" />
                  </Button>
                  {!inv.revoked && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate({ id: inv.id })}
                      data-testid={`revoke-invite-${inv.id}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} ariaLabel={t`Create invite link`}
        data-testid="create-invite-dialog"
        title={<Trans>Create an invite link</Trans>}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}><Trans>Cancel</Trans></Button>
            <Button type="submit" form="invite-form" disabled={create.isPending}>
              {create.isPending ? <Trans>Creating…</Trans> : <Trans>Create link</Trans>}
            </Button>
          </>
        }>
        <form id="invite-form" className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate({
              requiresApproval,
              maxUses: maxUses ? Number(maxUses) : undefined,
              expiresInDays: expireDays ? Number(expireDays) : undefined,
            })
          }}>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!requiresApproval} onChange={(e) => setRequiresApproval(!e.target.checked)} data-testid="invite-auto-join" />
            <Trans>Auto-join (skip admin approval)</Trans>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-max"><Trans>Max uses (optional)</Trans></Label>
              <Input id="inv-max" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-exp"><Trans>Expires in days (optional)</Trans></Label>
              <Input id="inv-exp" type="number" min={1} value={expireDays} onChange={(e) => setExpireDays(e.target.value)} placeholder="∞" />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
