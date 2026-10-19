import { sql } from 'drizzle-orm'

import { books, libraries, user, type Database } from '@obc/db'

import { AuditService } from './audit'
import { TenantAdminService } from './index'

/**
 * System overview for the super-admin dashboard: headline counts, the most
 * recent system-level audit entries, and a per-tenant snapshot. Composes
 * existing queries (TenantAdminService.listAll + AuditService.listSystem) so
 * there is a single aggregate endpoint for the Overview page.
 */
export class OverviewService {
  constructor(private db: Database) {}

  async get() {
    const count = async (table: typeof libraries | typeof user | typeof books) => {
      const row = await this.db.select({ c: sql<number>`count(*)` }).from(table).get()
      return row?.c ?? 0
    }

    const [tenants, users, booksCount] = await Promise.all([
      count(libraries),
      count(user),
      count(books),
    ])

    const recentAudit = await new AuditService(this.db).listSystem({ limit: 5 })
    const tenantList = await new TenantAdminService(this.db).listAll()

    return {
      counts: { tenants, users, books: booksCount },
      recentAudit,
      tenants: tenantList,
    }
  }
}
