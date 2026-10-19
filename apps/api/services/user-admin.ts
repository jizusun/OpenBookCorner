import { desc, eq, like, or, sql } from 'drizzle-orm'

import { libraries, user, type Database } from '@obc/db'

export interface UserListFilters {
  search?: string
  /** 1-based page. */
  page?: number
  limit?: number
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string
  libraryId: string | null
  libraryName: string | null
}

/**
 * System-level (super-admin) read of ALL login users across every tenant, with
 * their resolved library name + role. This is deliberately NOT tenant-scoped —
 * it is the global user directory for the super-admin console (impersonation
 * entry point). It must only ever be reached behind the super-admin guard.
 */
export class UserAdminService {
  constructor(private db: Database) {}

  async listAll(filters: UserListFilters): Promise<{ items: AdminUserRow[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 200)
    const page = Math.max(filters.page ?? 1, 1)
    const offset = (page - 1) * limit

    const where = filters.search
      ? or(
          like(sql`lower(${user.name})`, `%${filters.search.toLowerCase()}%`),
          like(sql`lower(${user.email})`, `%${filters.search.toLowerCase()}%`),
        )
      : undefined

    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        libraryId: user.libraryId,
        libraryName: libraries.name,
      })
      .from(user)
      .leftJoin(libraries, eq(user.libraryId, libraries.id))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const totalRow = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(where)
      .get()

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        libraryId: r.libraryId ?? null,
        libraryName: r.libraryName ?? null,
      })),
      total: totalRow?.count ?? 0,
    }
  }
}
