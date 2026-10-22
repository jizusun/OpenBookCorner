import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { UserMinus, Link2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/library-users')({
  pendingComponent: () => <ListPageSkeleton />,
  beforeLoad: ({ context }) => {
    const { role } = context.user
    if (role !== 'library_admin' && role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: LibraryUsersPage,
})

function LibraryUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()

  const { data: users = [], isLoading } = useQuery(api.membership.adminUsers.queryOptions())

  const remove = useMutation({
    ...api.membership.remove.mutationOptions(),
    onSuccess: () => {
      toast.success(t`User removed from this library.`)
      queryClient.invalidateQueries({ queryKey: ['membership', 'adminUsers'] })
    },
    onError: () => toast.error(t`Could not remove user.`),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold"><Trans>Users</Trans></h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Members with a login account in this library.</Trans>
          </p>
        </div>
        {/* Invite user = go to invite links page */}
        <Button
          onClick={() => router.navigate({ to: '/admin/invites' })}
          data-testid="invite-user-btn"
        >
          <Link2 className="size-4" />
          <Trans>Invite user</Trans>
        </Button>
      </div>

      {isLoading && <ListPageSkeleton />}

      {!isLoading && users.length === 0 && (
        <EmptyState
          icon="👤"
          title={<Trans>No users yet</Trans>}
          description={<Trans>Invite people using an invite link. They'll appear here after joining.</Trans>}
        />
      )}

      {!isLoading && users.length > 0 && (
        <div className="space-y-2">
          {(users as Array<{ userId: string; name: string; email: string; role: string; joinedAt: string }>)
            .map((u) => (
              <Card key={u.userId} data-testid={`user-row-${u.userId}`}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'library_admin' ? 'default' : 'secondary'}>
                    {u.role === 'library_admin' ? <Trans>Admin</Trans> : <Trans>Reader</Trans>}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove.mutate({ userId: u.userId })}
                    disabled={remove.isPending}
                    data-testid={`remove-user-${u.userId}`}
                    title={t`Remove from library`}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
