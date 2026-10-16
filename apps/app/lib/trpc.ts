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
