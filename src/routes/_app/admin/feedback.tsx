import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { listFeedback } from '@/server/functions/feedback'
import { me } from '@/server/functions/auth'
import { Badge } from '@/components/ui/badge'

const CATEGORY_LABELS: Record<string, string> = {
  feature_request: 'Feature request',
  book_suggestion: 'Book suggestion',
  bug: 'Bug',
  other: 'Other',
}

export const Route = createFileRoute('/_app/admin/feedback')({
  beforeLoad: async () => {
    const user = await me()
    if (user.role !== 'library_admin' && user.role !== 'super_admin') {
      throw redirect({ to: '/books' })
    }
  },
  component: FeedbackPage,
})

function FeedbackPage() {
  const listFn = useServerFn(listFeedback)
  const { data: items, isLoading } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => listFn({ data: undefined }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">User Feedback</h1>
      <p className="text-sm text-muted-foreground">
        What readers are asking for — use this to prioritize features.
      </p>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && items && items.length === 0 && (
        <p className="text-muted-foreground" data-testid="feedback-empty">
          No feedback yet.
        </p>
      )}

      <div className="space-y-3">
        {items?.map((f) => (
          <div key={f.id} className="rounded-md border p-4" data-testid="feedback-item">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="outline">{CATEGORY_LABELS[f.category] ?? f.category}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(f.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm">{f.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              — {f.submitterName} ({f.submitterEmail})
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
