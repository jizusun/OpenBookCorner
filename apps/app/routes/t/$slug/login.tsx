import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '../../login'

/**
 * Path-based tenant login (ADR 0003): `/t/:slug/login` renders the shared login
 * page, passing the path slug so it fetches that tenant's branding. The slug is
 * presentational only — authentication + isolation come from the Better Auth
 * session (`user.libraryId`), never the path.
 */
export const Route = createFileRoute('/t/$slug/login')({
  component: TenantLogin,
})

function TenantLogin() {
  const { slug } = Route.useParams()
  return <LoginPage slug={slug} />
}
