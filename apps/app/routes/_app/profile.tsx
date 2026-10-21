import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/UserAvatar'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function roleLabel(role: string) {
  // Rendered via <Trans> at call sites; this just maps to a stable node.
  switch (role) {
    case 'super_admin':
      return <Trans>Super admin</Trans>
    case 'library_admin':
      return <Trans>Admin</Trans>
    case 'library_reader':
      return <Trans>Reader</Trans>
    default:
      return <>{role || '—'}</>
  }
}

function ProfilePage() {
  const { user } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const [name, setName] = useState(user.name)
  const [pending, setPending] = useState(false)
  const dirty = name.trim() !== user.name && name.trim().length > 0

  async function save() {
    if (!dirty) return
    setPending(true)
    try {
      const res = await authClient.updateUser({ name: name.trim() })
      if (res?.error) {
        toast.error(res.error.message ?? t`Could not update your profile.`)
        return
      }
      // Refresh the cached identity so the sidebar + header pick up the new name.
      await queryClient.invalidateQueries(api.auth.requireMe.queryOptions())
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      toast.success(t`Profile updated.`)
    } catch {
      toast.error(t`Could not update your profile.`)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={user.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{user.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Account</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <Label htmlFor="profile-name">
              <Trans>Display name</Trans>
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="profile-name"
              maxLength={80}
            />
          </div>

          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">
              <Trans>Email</Trans>
            </dt>
            <dd data-testid="profile-email">{user.email}</dd>
            <dt className="text-muted-foreground">
              <Trans>Role</Trans>
            </dt>
            <dd data-testid="profile-role">{roleLabel(user.role)}</dd>
          </dl>

          <div className="flex justify-end">
            <Button onClick={save} disabled={!dirty || pending} data-testid="profile-save">
              {pending ? <Trans>Saving…</Trans> : <Trans>Save changes</Trans>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
