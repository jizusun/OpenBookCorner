import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/welcome')({
  component: WelcomePage,
})

function WelcomePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [domains, setDomains] = useState('')

  const create = useMutation({
    ...api.membership.createLibrary.mutationOptions(),
    onSuccess: async () => {
      toast.success(t`Library created.`)
      // Refresh identity (now has an active library) + reload into the app.
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      await queryClient.refetchQueries(api.auth.requireMe.queryOptions())
      await router.invalidate()
      await router.navigate({ to: '/books' })
    },
    onError: () => toast.error(t`Could not create the library.`),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const list = domains.split(',').map((d) => d.trim()).filter(Boolean)
    if (!name.trim()) return
    create.mutate({ name: name.trim(), emailDomains: list })
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">
          <Trans>Welcome to OpenBookCorner</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>You're not part of any library yet. Create one, or join an existing one.</Trans>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Create a library</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <Trans>Start a new library and become its admin.</Trans>
            </p>
            <Button onClick={() => setOpen(true)} data-testid="welcome-create-open">
              <Trans>Create a library</Trans>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Join a library</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <Trans>Browse public libraries and request to join, or open an invite link.</Trans>
            </p>
            <Button
              variant="outline"
              onClick={() => router.navigate({ to: '/discover' })}
              data-testid="welcome-discover"
            >
              <Trans>Discover libraries</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={t`Create a library`}
        data-testid="welcome-create-dialog"
        title={<Trans>Create a library</Trans>}
        description={<Trans>Give the library a name and the email domains its members use.</Trans>}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" form="welcome-create-form" disabled={create.isPending}>
              {create.isPending ? <Trans>Creating…</Trans> : <Trans>Create library</Trans>}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4" id="welcome-create-form">
          <div className="space-y-2">
            <Label htmlFor="wl-name">
              <Trans>Library name</Trans>
            </Label>
            <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="welcome-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wl-domains">
              <Trans>Email domains (comma-separated, optional)</Trans>
            </Label>
            <Input
              id="wl-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder={t`@acme.com, @acme.io`}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
