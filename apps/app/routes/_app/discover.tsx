import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/discover')({
  pendingComponent: () => <ListPageSkeleton />,
  component: DiscoverPage,
})

function DiscoverPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: libs, isLoading } = useQuery(api.join.discover.queryOptions())
  const { data: mine } = useQuery(api.membership.mine.queryOptions())
  const hasLibrary = (mine ?? []).length > 0

  const request = useMutation({
    ...api.join.request.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Request submitted. The library admin will review it.`)
      queryClient.invalidateQueries({ queryKey: ['join', 'discover'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { error?: string })?.error
      if (msg === 'REQUEST_PENDING') toast.error(t`You already have a pending request for this library.`)
      else if (msg === 'ALREADY_MEMBER') toast.error(t`You are already a member of this library.`)
      else toast.error(t`Could not submit request.`)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            <Trans>Discover libraries</Trans>
          </h1>
          <p className="text-sm text-muted-foreground">
            <Trans>Public libraries you can request to join.</Trans>
          </p>
        </div>
        <Button variant="outline" onClick={() => router.navigate({ to: hasLibrary ? '/books' : '/welcome' })}>
          <Trans>Back</Trans>
        </Button>
      </div>

      {isLoading && <ListPageSkeleton />}

      {!isLoading && (!libs || libs.length === 0) && (
        <EmptyState
          icon="🔎"
          title={<Trans>No public libraries found</Trans>}
          description={<Trans>No public libraries are available to join at the moment.</Trans>}
        />
      )}

      {!isLoading && libs && libs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {libs.map((lib) => (
            <Card key={lib.id}>
              <CardHeader>
                <CardTitle className="text-base">{lib.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  onClick={() => request.mutate({ libraryId: lib.id })}
                  disabled={request.isPending}
                  data-testid={`request-join-${lib.id}`}
                >
                  <Trans>Request to join</Trans>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
