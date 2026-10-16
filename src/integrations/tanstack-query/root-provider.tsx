import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClient } from '@tanstack/react-query-persist-client'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep cached data for 24h so it survives reloads and offline use.
        gcTime: 1000 * 60 * 60 * 24,
        staleTime: 1000 * 30,
        retry: 1,
      },
    },
  })

  // Persist the query cache to localStorage on the client only (SSR-safe).
  if (typeof window !== 'undefined') {
    const persister = createSyncStoragePersister({ storage: window.localStorage })
    // Only persist shareable catalog data for offline browsing. User-specific /
    // auth-scoped queries (My Books, settings, feedback, overdue, current user)
    // must NOT be restored from localStorage: a stale/empty snapshot could render
    // before a refetch, and it would leak data across users on a shared browser.
    const PERSISTED_PREFIXES = ['books', 'book']
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      buster: 'obc-v2',
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const root = query.queryKey[0]
          return typeof root === 'string' && PERSISTED_PREFIXES.includes(root)
        },
      },
    })
  }

  return {
    queryClient,
  }
}

export default function TanstackQueryProvider() {}
