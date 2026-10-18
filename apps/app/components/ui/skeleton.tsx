import { useEffect, useState } from 'react'

import { useLingui } from '@lingui/react/macro'

import { cn } from '@/lib/utils'

/** Shimmering placeholder used while data loads. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-md bg-muted/70', className)} {...props} />
  )
}

/**
 * Delayed reassurance for slow networks. Renders nothing until `delayMs` has
 * passed, then reveals a gentle "still loading" line. This follows NN/g's
 * guidance for the 2–10s band: give *less conspicuous* progress feedback (not a
 * fake percent bar), and only once the wait exceeds expectation (~1.5s) so fast
 * loads never show it. Addresses slow-network anxiety (e.g. China) by telling
 * the user it's the network, not a bug.
 */
export function SlowHint({
  delayMs = 1500,
  className,
  children,
}: {
  delayMs?: number
  className?: string
  children?: React.ReactNode
}) {
  const { t } = useLingui()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(id)
  }, [delayMs])

  if (!show) return null

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="slow-hint"
      className={cn(
        'animate-in fade-in text-center text-xs text-muted-foreground motion-reduce:animate-none',
        className,
      )}
    >
      {children ?? t`Slow network — still loading, hang tight…`}
    </p>
  )
}

/** A list of card-shaped skeletons matching the BookCard / My Books layout. */
export function BookListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4" aria-hidden data-testid="loading-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border bg-card p-4">
          <Skeleton className="h-28 w-20 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
            <div className="mt-auto flex items-center justify-between pt-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Full list PAGE skeleton (title + a controls row + the card list), used as a
 * route `pendingComponent` so a navigation to a list page shows the shape of
 * the destination during the wait — not a blank body. Research shows a
 * layout-matching skeleton feels ~30% faster than a spinner at the same load
 * time. Includes a delayed SlowHint for long waits.
 */
export function ListPageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4" data-testid="page-skeleton-list">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1 min-w-40" />
        <Skeleton className="h-9 w-20" />
      </div>
      <BookListSkeleton count={count} />
      <SlowHint />
    </div>
  )
}

/** Detail PAGE skeleton (cover + title block + field rows). */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-4" data-testid="page-skeleton-detail">
      <div className="flex gap-4">
        <Skeleton className="h-40 w-28 shrink-0" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-auto h-9 w-28" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <SlowHint />
    </div>
  )
}

/** Form PAGE skeleton (label + field pairs + submit), for add/edit/settings. */
export function FormPageSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-4" data-testid="page-skeleton-form">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-28" />
      <SlowHint />
    </div>
  )
}
