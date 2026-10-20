import { desc, eq, like, or, sql } from 'drizzle-orm'

import { books, libraries, type Database } from '@obc/db'

export interface BookListFilters {
  search?: string
  page?: number
  limit?: number
}

export interface AdminBookRow {
  id: string
  title: string
  author: string
  isbn: string
  libraryId: string
  libraryName: string | null
  quantity: number
  availableCount: number
}

/**
 * System-level (super-admin) read of ALL books across every tenant, with their
 * resolved library name. Cross-tenant by design for the super-admin console;
 * must be reached only behind the super-admin guard. (Mirrors UserAdminService.)
 */
export class BookAdminService {
  constructor(private db: Database) {}

  async listAll(filters: BookListFilters): Promise<{ items: AdminBookRow[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 200)
    const page = Math.max(filters.page ?? 1, 1)
    const offset = (page - 1) * limit

    const s = filters.search?.trim().toLowerCase()
    const where = s
      ? or(
          like(sql`lower(${books.title})`, `%${s}%`),
          like(sql`lower(${books.author})`, `%${s}%`),
          like(sql`lower(${books.isbn})`, `%${s}%`),
        )
      : undefined

    const rows = await this.db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        libraryId: books.libraryId,
        libraryName: libraries.name,
        quantity: books.quantity,
        availableCount: books.availableCount,
      })
      .from(books)
      .leftJoin(libraries, eq(books.libraryId, libraries.id))
      .where(where)
      .orderBy(desc(books.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const totalRow = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(where)
      .get()

    return {
      items: rows.map((r) => ({ ...r, libraryName: r.libraryName ?? null })),
      total: totalRow?.count ?? 0,
    }
  }
}
