import type { AppRouter } from '@obc/api'
import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client'
import { createTRPCOptionsProxy, type TRPCOptionsProxy } from '@trpc/tanstack-react-query'

import { queryClient } from './query'

/** Raw tRPC client — same-origin /api/trpc, cookies included for auth. */
export const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})

/**
 * TanStack Query proxy: `trpc.book.list.queryOptions(...)`,
 * `trpc.borrowing.borrow.mutationOptions(...)`, etc.
 */
export const trpc: TRPCOptionsProxy<AppRouter> = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})

/**
 * Resolve the current user for route guards, CACHED through TanStack Query.
 * Route `beforeLoad` runs on hover-preload (defaultPreload:'intent') too, so a
 * raw `trpcClient.auth.requireMe.query()` in every admin route fired a fresh
 * uncached request per hovered menu item. Going through `ensureQueryData`
 * dedupes to a single request (honoring the 30s staleTime) and the real
 * navigation reuses the cache. Throws (→ redirect to /login) when unauthed.
 */
export function ensureRequireMe() {
  return queryClient.ensureQueryData(trpc.auth.requireMe.queryOptions())
}
