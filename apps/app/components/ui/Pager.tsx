import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'

export interface PagerProps {
  page: number
  hasMore: boolean
  onPrev: () => void
  onNext: () => void
  'data-testid'?: string
}

/**
 * Reusable Previous / Page N / Next pager for the admin list pages (Users,
 * Books, Audit). Keeps pagination identical everywhere.
 */
export function Pager({ page, hasMore, onPrev, onNext, ...rest }: PagerProps) {
  return (
    <div className="flex items-center justify-between text-sm" data-testid={rest['data-testid']}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev} data-testid="pager-prev">
        <Trans>Previous</Trans>
      </Button>
      <span className="text-muted-foreground">
        <Trans>Page {page}</Trans>
      </span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={onNext} data-testid="pager-next">
        <Trans>Next</Trans>
      </Button>
    </div>
  )
}
