/**
 * Tenant login branding (ADR 0003). The PUBLIC, pre-auth endpoint
 * `GET /api/public/branding` resolves the tenant from the request Host
 * subdomain (the Worker reads it server-side) and returns ONLY safe fields, or
 * `null` on the apex / a reserved / unknown host.
 *
 * This is purely presentational: it selects which login branding to show before
 * the user authenticates. It NEVER affects auth — `user.libraryId` from the
 * verified session remains the only source of truth for tenant isolation.
 */

/** Safe, public branding fields for the tenant login page. */
export interface TenantBranding {
  name: string
  logoUrl: string | null
  brandColor: string | null
  loginWelcome: string | null
}

/**
 * Fetch a tenant's login branding by slug (same-origin, cookies included).
 * Path-based tenancy: the caller reads the slug from the `/t/:slug` path and
 * passes it here. Returns `null` for a missing/unknown slug or on failure — the
 * caller then renders the standard unbranded login. Never throws.
 */
export async function fetchBranding(slug: string | undefined): Promise<TenantBranding | null> {
  if (!slug) return null
  try {
    const res = await fetch(`/api/public/branding?slug=${encodeURIComponent(slug)}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const body = (await res.json()) as TenantBranding | null
    return body ?? null
  } catch {
    return null
  }
}
