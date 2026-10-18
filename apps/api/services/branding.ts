import { and, eq } from 'drizzle-orm'

import { libraries, type Database } from '@obc/db'

import { isValidSlug } from '../lib/tenant'

/** Only the fields safe to expose on the PUBLIC (pre-auth) branding endpoint. */
export interface TenantBranding {
  name: string
  logoUrl: string | null
  brandColor: string | null
  loginWelcome: string | null
}

/**
 * Resolves a tenant's PUBLIC login branding by slug. Returns only safe fields —
 * never emailDomains, settings, ids, or status. Rejects reserved/invalid slugs
 * before querying, and treats inactive tenants as not found.
 */
export class TenantBrandingService {
  constructor(private db: Database) {}

  async getBySlug(slug: string): Promise<TenantBranding | null> {
    if (!isValidSlug(slug)) return null
    const row = await this.db
      .select({
        name: libraries.name,
        logoUrl: libraries.logoUrl,
        brandColor: libraries.brandColor,
        loginWelcome: libraries.loginWelcome,
      })
      .from(libraries)
      .where(and(eq(libraries.slug, slug), eq(libraries.isActive, true)))
      .get()
    return row ?? null
  }
}
