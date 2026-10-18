import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ToastProvider } from '@/components/Toast'
import { RouteProgress } from '@/components/RouteProgress'
import { I18nProvider } from '@/lib/i18n'
import { queryClient } from '@/lib/query'
import { routeTree } from '@/lib/routeTree.gen'

import './styles/globals.css'

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Loading UX: skeletons are the PRIMARY loading language (per-route
  // pendingComponent shows the destination's shape). RouteProgress is a subtle
  // secondary accent — kept indeterminate (NOT a fake percent, which NN/g warns
  // is overkill/stressful in the 2–10s band). Acknowledge a click almost
  // instantly (30ms) so navigation never feels ignored on slow networks, but
  // keep it visible ≥300ms once shown to avoid flicker on fast/preloaded nav.
  defaultPendingComponent: RouteProgress,
  defaultPendingMs: 30,
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
      <I18nProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
