import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  /** Decorative emoji/icon shown above the title. */
  icon?: ReactNode
  title: string
  description?: string
  /** Optional call-to-action (e.g. a Link styled as a button). */
  action?: ReactNode
  'data-testid'?: string
}

/** Consistent zero-state used across catalog, My Books, overdue, feedback. */
export function EmptyState({ icon, title, description, action, ...rest }: EmptyStateProps) {
  return (
    <Card data-testid={rest['data-testid']}>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        {icon && (
          <div className="text-3xl" aria-hidden>
            {icon}
          </div>
        )}
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
        {action}
      </CardContent>
    </Card>
  )
}
