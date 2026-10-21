import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ListPageSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/Toast'

export const Route = createFileRoute('/_app/admin/join-requests')({
  pendingComponent: () => <ListPageSkeleton />,
  beforeLoad: ({ context }) => {
    const role = context.user.role
    if (role !== 'library_admin' && role !== 'super_admin') throw redirect({ to: '/books' })
  },
  component: JoinRequestsPage,
})

function JoinRequestsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLingui()
  const { data: requests, isLoading } = useQuery(api.join.adminRequests.queryOptions())

  const approve = useMutation({
    ...api.join.approve.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Request approved.`)
      queryClient.invalidateQueries({ queryKey: ['join', 'adminRequests'] })
    },
  })
  const reject = useMutation({
    ...api.join.reject.mutationOptions(),
    onSuccess: () => {
      toast.success(t`Request rejected.`)
      queryClient.invalidateQueries({ queryKey: ['join', 'adminRequests'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          <Trans>Join requests</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>Pending requests from users who want to join this library.</Trans>
        </p>
      </div>

      {isLoading && <ListPageSkeleton />}

      {!isLoading && (!requests || requests.length === 0) && (
        <EmptyState
          icon="📬"
          title={<Trans>No pending requests</Trans>}
          description={<Trans>New join requests will appear here.</Trans>}
        />
      )}

      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} data-testid={`join-request-${req.id}`}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">{req.userName}</p>
                  <p className="text-sm text-muted-foreground">{req.userEmail}</p>
                  {req.answers && Object.keys(req.answers).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(req.answers).map(([k, v]) => (
                        <p key={k} className="text-xs text-muted-foreground">
                          <span className="font-medium">{k}:</span> {v}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{req.via}</Badge>
                  <Button
                    size="sm"
                    onClick={() => approve.mutate({ requestId: req.id })}
                    disabled={approve.isPending || reject.isPending}
                    data-testid={`approve-${req.id}`}
                  >
                    <Trans>Approve</Trans>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject.mutate({ requestId: req.id })}
                    disabled={approve.isPending || reject.isPending}
                    data-testid={`reject-${req.id}`}
                  >
                    <Trans>Reject</Trans>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
