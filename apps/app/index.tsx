import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ToastProvider } from '@/components/Toast'
import { RouteProgress } from '@/components/RouteProgress'
import { queryClient } from '@/lib/query'
import { routeTree } from '@/lib/routeTree.gen'

import './styles/globals.css'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Show the slim top progress bar during transitions, but only after 150ms so
  // instant/preloaded navigations don't flash it. Keep it up at least 300ms to
  // avoid a flicker when it does appear.
  defaultPendingComponent: RouteProgress,
  defaultPendingMs: 150,
  defaultPendingMinMs: 300,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('root')!
// Remove the instant inline loader (index.html) before React takes over the root.
container.replaceChildren()
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
