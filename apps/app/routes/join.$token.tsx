import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/join/$token')({
  component: JoinPage,
})

function JoinPage() {
  const { token } = Route.useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { t } = useLingui()

  const { data: resolved, isLoading, isError } = useQuery({
    ...api.invite.resolve.queryOptions({ token }),
    retry: false,
  })

  const { data: me } = useQuery({
    ...api.auth.me.queryOptions(),
    retry: false,
  })

  const use = useMutation({
    ...api.invite.use.mutationOptions(),
    onSuccess: async () => {
      queryClient.clear()
      await router.invalidate()
      await router.navigate({ to: '/books' })
    },
  })

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground"><Trans>Loading…</Trans></p>
    </div>
  )

  if (isError || !resolved) return (
    <div className="flex h-screen items-center justify-center">
      <EmptyState icon="❌" title={<Trans>Invalid or expired invite</Trans>}
        description={<Trans>This invite link is no longer valid.</Trans>} />
    </div>
  )

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            <Trans>You've been invited to join</Trans>
          </h1>
          <p className="text-xl font-medium text-primary">{resolved.libraryName}</p>
        </div>
        {resolved.requiresApproval ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Your request will need approval from the library admin.</Trans>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Trans>You'll be added immediately.</Trans>
          </p>
        )}
        {me ? (
          <Button className="w-full" onClick={() => use.mutate({ token })} disabled={use.isPending}
            data-testid="invite-join-btn">
            {use.isPending
              ? <Trans>Joining…</Trans>
              : resolved.requiresApproval
                ? <Trans>Submit request</Trans>
                : <Trans>Join library</Trans>}
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground"><Trans>You need to sign in first.</Trans></p>
            <Button className="w-full" onClick={() => router.navigate({ to: '/login' })}
              data-testid="invite-signin-btn">
              <Trans>Sign in to join</Trans>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
