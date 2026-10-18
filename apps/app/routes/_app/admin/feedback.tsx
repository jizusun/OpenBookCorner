import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

function CategoryLabel({ category }: { category: string }) {
  switch (category) {
    case 'feature_request':
      return <Trans>Feature request</Trans>
    case 'book_suggestion':
      return <Trans>Book suggestion</Trans>
    case 'bug':
      return <Trans>Bug</Trans>
    case 'other':
      return <Trans>Other</Trans>
    default:
      return <>{category}</>
  }
}

export const Route = createFileRoute('/_app/admin/feedback')({
  beforeLoad: ({ context }) => {
    const user = context.user
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: FeedbackPage,
})

function FeedbackPage() {
  const { data: items, isLoading } = useQuery(trpc.feedback.list.queryOptions())

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <Trans>User Feedback</Trans>
      </h1>
      <p className="text-sm text-muted-foreground">
        <Trans>What readers are asking for — use this to prioritize features.</Trans>
      </p>

      {isLoading && (
        <div className="space-y-3" data-testid="loading-skeleton">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {!isLoading && items && items.length === 0 && (
        <EmptyState
          data-testid="feedback-empty"
          icon="💬"
          title={<Trans>No feedback yet</Trans>}
          description={<Trans>When readers send feedback, it will show up here.</Trans>}
        />
      )}

      <div className="space-y-3">
        {items?.map((f) => (
          <div key={f.id} className="rounded-md border p-4" data-testid="feedback-item">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="outline">
                <CategoryLabel category={f.category} />
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(f.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm">{f.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <Trans>
                — {f.submitterName} ({f.submitterEmail})
              </Trans>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
