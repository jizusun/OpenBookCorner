import { cn } from '@/lib/utils'

/** Shimmering placeholder used while data loads. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted/70', className)}
      {...props}
    />
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
