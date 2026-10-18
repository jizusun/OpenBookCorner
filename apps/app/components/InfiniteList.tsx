import { useEffect, useRef } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'

/**
 * Reusable "paged list → infinite scroll" primitive shared by the catalog and
 * members pages (same UX: search + sort + filter + infinite scroll). Wraps
 * useInfiniteQuery over a page-fetching function that returns
 * { items, page, totalPages, total }.
 */
export interface Page<T> {
  items: T[]
  page: number
  totalPages: number
  total: number
}

export function useInfiniteList<T>(
  queryKey: unknown[],
  fetchPage: (page: number) => Promise<Page<T>>,
) {
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    // Keep the previous results visible while a new filter/sort/search set loads,
    // so changing a control dims-in-place instead of blanking the list — a key
    // perceived-performance win on slow networks.
    placeholderData: keepPreviousData,
  })
  const items: T[] = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  return { ...query, items, total }
}

/**
 * Sentinel that triggers the next page when scrolled into view, with a manual
 * "加载更多" fallback (for environments without IntersectionObserver).
 */
export function LoadMoreSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (!hasNextPage) return null
  return (
    <div ref={ref} className="flex justify-center py-4" data-testid="load-more">
      <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={fetchNextPage}>
        {isFetchingNextPage ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
      </Button>
    </div>
  )
}
