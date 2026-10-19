import { createFileRoute, redirect } from '@tanstack/react-router'

import { ensureRequireMe } from '@/lib/api'

/**
 * Tenant index `/t/:slug/` — not a page, just a redirect:
 *  - authenticated → into the app (`/my-books`, same landing as `/`).
 *  - anonymous     → the tenant's branded login `/t/:slug/login`.
 * The slug is presentational/branding only; auth + isolation remain the session.
 */
export const Route = createFileRoute('/t/$slug/')({
  beforeLoad: async ({ params }) => {
    let authed = false
    try {
      await ensureRequireMe()
      authed = true
    } catch {
      authed = false
    }
    throw authed
      ? redirect({ to: '/my-books' })
      : redirect({ to: '/t/$slug/login', params: { slug: params.slug } })
  },
})
