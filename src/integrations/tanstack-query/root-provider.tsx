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
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      buster: 'obc-v1',
    })
  }

  return {
    queryClient,
  }
}

export default function TanstackQueryProvider() {}
