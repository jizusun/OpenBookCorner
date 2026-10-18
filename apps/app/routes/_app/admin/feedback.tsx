import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n, type MessageKey } from '@/lib/i18n'

const CATEGORY_LABEL_KEYS: Record<string, MessageKey> = {
  feature_request: 'feedbackList.category.feature_request',
  book_suggestion: 'feedbackList.category.book_suggestion',
  bug: 'feedbackList.category.bug',
  other: 'feedbackList.category.other',
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
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('feedbackList.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('feedbackList.subtitle')}
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
          title={t('feedbackList.empty.title')}
          description={t('feedbackList.empty.description')}
        />
      )}

      <div className="space-y-3">
        {items?.map((f) => (
          <div key={f.id} className="rounded-md border p-4" data-testid="feedback-item">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge variant="outline">
                {CATEGORY_LABEL_KEYS[f.category] ? t(CATEGORY_LABEL_KEYS[f.category]!) : f.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(f.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm">{f.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('feedbackList.by', { name: f.submitterName, email: f.submitterEmail })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
