/**
 * Worker-side 番薯 import service. Runs inside the Worker (via ctx.db, a D1
 * Drizzle client). The admin UI parses the uploaded .xls in the browser and
 * sends the raw sheet rows; this service runs the pure transforms and writes to
 * D1 in chunked batches (D1 caps statements per batch).
 *
 * Idempotent: deterministic ids + onConflictDoUpdate(set=…) means re-running the
 * import updates existing rows instead of duplicating. Tenant-scoped: everything
 * is written under the given libraryId.
 */
import {
  books,
  borrowTransactions,
  members,
  purchaseRequests,
  reviews,
  type Database,
} from '@obc/db'

import {
  transformBooks,
  transformLoans,
  transformMembers,
  transformPurchaseRequests,
  transformReviews,
  type Row,
  type TransformInput,
} from './fanshuTransform'

export interface FanshuSheets {
  books: Row[] // 书籍清单
  stock: Row[] // 存量明细
  members: Row[] // 成员清单
  loans: Row[] // 借阅清单
  reviews: Row[] // 评论清单
  purchaseRequests: Row[] // 荐购清单
}

export interface ImportCounts {
  books: number
  members: number
  loans: number
  reviews: number
  purchaseRequests: number
  orphanLoans: { noMember: number; noBook: number }
}

const BATCH = 50 // keep each D1 batch well under statement limits

async function insertChunked<T>(
  db: Database,
  rows: T[],
  makeStmt: (row: T) => unknown,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    if (slice.length === 0) continue
    // db.batch expects a non-empty tuple; cast is safe (we guard length).
    const stmts = slice.map(makeStmt) as unknown as [unknown, ...unknown[]]
    await (db as unknown as { batch: (s: unknown[]) => Promise<unknown> }).batch(stmts)
  }
}

/** Transform-only (no writes) — used for the UI preview. */
export function previewFanshuImport(libraryId: string, sheets: FanshuSheets): ImportCounts {
  const input: TransformInput = { libraryId, ...sheets }
  const b = transformBooks(input)
  const m = transformMembers(input)
  const memberIdByName = new Map<string, string>()
  for (const row of m) {
    const original = String((row.raw as Row)['姓名'] ?? '').trim()
    if (original) memberIdByName.set(original, row.id)
  }
  const bookIdByIsbn = new Map(b.map((x) => [x.isbn, x.id]))
  const { loans, orphans } = transformLoans(input, memberIdByName, bookIdByIsbn)
  return {
    books: b.length,
    members: m.length,
    loans: loans.length,
    reviews: transformReviews(input).length,
    purchaseRequests: transformPurchaseRequests(input).length,
    orphanLoans: orphans,
  }
}

export class FanshuImportService {
  constructor(private db: Database) {}

  /** Run the full import into `libraryId`. Idempotent (upsert by id). */
  async import(libraryId: string, sheets: FanshuSheets): Promise<ImportCounts> {
    const input: TransformInput = { libraryId, ...sheets }

    const memberRows = transformMembers(input)
    const bookRows = transformBooks(input)

    const memberIdByName = new Map<string, string>()
    for (const row of memberRows) {
      const original = String((row.raw as Row)['姓名'] ?? '').trim()
      if (original) memberIdByName.set(original, row.id)
    }
    const bookIdByIsbn = new Map(bookRows.map((x) => [x.isbn, x.id]))
    const { loans, orphans } = transformLoans(input, memberIdByName, bookIdByIsbn)
    const reviewRows = transformReviews(input)
    const recRows = transformPurchaseRequests(input)

    // Order matters for FKs: members + books before loans.
    await insertChunked(this.db, memberRows, (r) =>
      this.db.insert(members).values(r).onConflictDoUpdate({ target: members.id, set: r }),
    )
    await insertChunked(this.db, bookRows, (r) =>
      this.db.insert(books).values(r).onConflictDoUpdate({ target: books.id, set: r }),
    )
    await insertChunked(this.db, loans, (r) =>
      this.db
        .insert(borrowTransactions)
        .values(r)
        .onConflictDoUpdate({ target: borrowTransactions.id, set: r }),
    )
    await insertChunked(this.db, reviewRows, (r) =>
      this.db.insert(reviews).values(r).onConflictDoUpdate({ target: reviews.id, set: r }),
    )
    await insertChunked(this.db, recRows, (r) =>
      this.db
        .insert(purchaseRequests)
        .values(r)
        .onConflictDoUpdate({ target: purchaseRequests.id, set: r }),
    )

    return {
      books: bookRows.length,
      members: memberRows.length,
      loans: loans.length,
      reviews: reviewRows.length,
      purchaseRequests: recRows.length,
      orphanLoans: orphans,
    }
  }
}
