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
import { desc, eq } from 'drizzle-orm'
import {
  books,
  borrowTransactions,
  members,
  purchaseRequests,
  reviews,
  importRuns,
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

// 番薯 sheet name → FanshuSheets key.
const SHEET_MAP: Record<string, keyof FanshuSheets> = {
  书籍清单: 'books',
  存量明细: 'stock',
  成员清单: 'members',
  借阅清单: 'loans',
  评论清单: 'reviews',
  荐购清单: 'purchaseRequests',
}

/** Parse a 番薯 .xls/.xlsx workbook (bytes) into FanshuSheets. */
export async function parseFanshuWorkbook(bytes: Uint8Array): Promise<FanshuSheets> {
  // Lazy import so SheetJS only loads on the import path (keeps it out of the
  // hot path of the Worker bundle for every request).
  const XLSX = await import('xlsx')
  const wb = XLSX.read(bytes, { type: 'array' })
  const out: FanshuSheets = {
    books: [], stock: [], members: [], loans: [], reviews: [], purchaseRequests: [],
  }
  for (const name of wb.SheetNames) {
    const key = SHEET_MAP[name]
    if (!key) continue
    out[key] = XLSX.utils.sheet_to_json(wb.Sheets[name]!, { defval: '' }) as Row[]
  }
  return out
}

/**
 * Fetch a 番薯 export from a URL and parse it. SSRF guard: https only, and the
 * host must be a 番薯 CDN host (the export links are *.fanshujieyue.com). This
 * runs admin-only, but we still refuse arbitrary/internal targets.
 */
export async function fetchFanshuWorkbook(url: string): Promise<FanshuSheets> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (u.protocol !== 'https:') throw new Error('URL_MUST_BE_HTTPS')
  if (!/(^|\.)fanshujieyue\.com$/i.test(u.hostname)) throw new Error('URL_HOST_NOT_ALLOWED')
  const res = await fetch(u.toString())
  if (!res.ok) throw new Error(`DOWNLOAD_FAILED_${res.status}`)
  const buf = await res.arrayBuffer()
  if (buf.byteLength > 20 * 1024 * 1024) throw new Error('FILE_TOO_LARGE')
  return parseFanshuWorkbook(new Uint8Array(buf))
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
  async import(
    libraryId: string,
    sheets: FanshuSheets,
    meta?: { sourceUrl?: string; r2Key?: string; fileName?: string; ranByUserId?: string },
  ): Promise<ImportCounts> {
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
      this.db
        .insert(books)
        .values(r)
        .onConflictDoUpdate({
          target: books.id,
          // On re-import, refresh catalog metadata but PRESERVE live inventory
          // (quantity/availableCount/isAvailable) — those are mutated by the app
          // as copies are borrowed/returned. Overwriting them with the original
          // stock snapshot would make an already-borrowed copy borrowable again.
          set: {
            isbn: r.isbn,
            title: r.title,
            author: r.author,
            publisher: r.publisher,
            copyCode: r.copyCode,
            category: r.category,
            shelfLocation: r.shelfLocation,
            translator: r.translator,
            series: r.series,
            pageCount: r.pageCount,
            price: r.price,
            priceUnit: r.priceUnit,
            cnLibraryClass: r.cnLibraryClass,
            enteredAt: r.enteredAt,
            isShelved: r.isShelved,
            publishedDate: r.publishedDate,
            publishedYear: r.publishedYear,
            wordCount: r.wordCount,
            source: r.source,
            raw: r.raw,
            updatedAt: r.updatedAt,
          },
        }),
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

    const counts = {
      books: bookRows.length,
      members: memberRows.length,
      loans: loans.length,
      reviews: reviewRows.length,
      purchaseRequests: recRows.length,
      orphanLoans: orphans,
    }

    // Audit trail: record where this import came from, who ran it, and counts.
    await this.db.insert(importRuns).values({
      id: crypto.randomUUID(),
      libraryId,
      source: 'fanshu',
      sourceUrl: meta?.sourceUrl ?? null,
      r2Key: meta?.r2Key ?? null,
      fileName: meta?.fileName ?? null,
      ranByUserId: meta?.ranByUserId ?? null,
      status: 'success',
      counts,
      createdAt: new Date().toISOString(),
    })

    return counts
  }

  /** Import audit history for a library, newest first. */
  async listRuns(libraryId: string) {
    return this.db
      .select()
      .from(importRuns)
      .where(eq(importRuns.libraryId, libraryId))
      .orderBy(desc(importRuns.createdAt))
      .all()
  }
}
