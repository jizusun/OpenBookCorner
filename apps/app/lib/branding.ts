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
 * Fetch the current host's tenant branding (same-origin, cookies included for
 * parity with the rest of the API client). Returns `null` for the apex / an
 * unknown host, or if the request fails — the caller then renders the standard
 * unbranded login. Never throws.
 */
export async function fetchBranding(): Promise<TenantBranding | null> {
  try {
    const res = await fetch('/api/public/branding', { credentials: 'include' })
    if (!res.ok) return null
    const body = (await res.json()) as TenantBranding | null
    return body ?? null
  } catch {
    return null
  }
}
