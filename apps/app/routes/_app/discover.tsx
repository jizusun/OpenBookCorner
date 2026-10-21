import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/_app/discover')({
  component: DiscoverPage,
})

// Step 4 (ADR 0009) fills this in with the public-library list + request-to-join.
// For now it's a placeholder so membership-less users have a reachable "join"
// destination from the welcome screen.
function DiscoverPage() {
  const router = useRouter()
  const { data: mine } = useQuery(api.membership.mine.queryOptions())
  const hasLibrary = (mine ?? []).length > 0

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          <Trans>Discover libraries</Trans>
        </h1>
        <p className="text-sm text-muted-foreground">
          <Trans>Public libraries you can request to join will appear here.</Trans>
        </p>
      </div>
      <EmptyState
        icon="🔎"
        title={<Trans>Nothing to show yet</Trans>}
        description={<Trans>Public library discovery is coming soon.</Trans>}
      />
      <Button variant="outline" onClick={() => router.navigate({ to: hasLibrary ? '/books' : '/welcome' })}>
        <Trans>Back</Trans>
      </Button>
    </div>
  )
}
