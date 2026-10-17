import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import {
  books,
  borrowTransactions,
  feedback,
  libraries,
  members,
  user,
  type Database,
  type LibrarySettings,
} from '@obc/db'

const DEFAULT_BORROW_DAYS = 14

export class BookService {
  constructor(private db: Database) {}

  async listByLibrary(
    libraryId: string,
    opts: {
      search?: string
      page?: number
      limit?: number
      sortBy?: 'enteredAt' | 'title' | 'author' | 'available' | 'price'
      sortDir?: 'asc' | 'desc'
      category?: string
      shelf?: string
      availability?: 'all' | 'available' | 'borrowed'
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1)
    const limit = Math.min(200, Math.max(1, opts.limit ?? 20))
    const offset = (page - 1) * limit

    const search = opts.search?.trim()
    const searchFilter = search
      ? or(like(books.title, `%${search}%`), like(books.author, `%${search}%`))
      : undefined
    const categoryFilter = opts.category ? eq(books.category, opts.category) : undefined
    const shelfFilter = opts.shelf ? eq(books.shelfLocation, opts.shelf) : undefined
    const availabilityFilter =
      opts.availability === 'available'
        ? sql`${books.availableCount} > 0`
        : opts.availability === 'borrowed'
          ? sql`${books.availableCount} = 0`
          : undefined
    const where = and(
      eq(books.libraryId, libraryId),
      searchFilter,
      categoryFilter,
      shelfFilter,
      availabilityFilter,
    )

    // Sort column + direction. Default = 上架时间 (enteredAt) desc, nulls last.
    const dir = opts.sortDir ?? 'desc'
    const col =
      opts.sortBy === 'title'
        ? books.title
        : opts.sortBy === 'author'
          ? books.author
          : opts.sortBy === 'available'
            ? books.availableCount
            : opts.sortBy === 'price'
              ? books.price
              : books.enteredAt
    const dirExpr = dir === 'asc' ? sql`${col} asc` : sql`${col} desc`
    const orderBy = [sql`${col} IS NULL`, dirExpr, desc(books.createdAt)]

    const items = await this.db
      .select()
      .from(books)
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)
      .all()

    const countRow = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(where)
      .get()
    const total = countRow?.count ?? 0

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }
  }

  /** Distinct categories + shelves for this library (for filter dropdowns). */
  async listFacets(libraryId: string) {
    const cats = await this.db
      .selectDistinct({ v: books.category })
      .from(books)
      .where(eq(books.libraryId, libraryId))
      .all()
    const shelves = await this.db
      .selectDistinct({ v: books.shelfLocation })
      .from(books)
      .where(eq(books.libraryId, libraryId))
      .all()
    const clean = (rows: { v: string | null }[]) =>
      rows
        .map((r) => r.v)
        .filter((v): v is string => !!v && v.trim() !== '')
        .sort()
    return { categories: clean(cats), shelves: clean(shelves) }
  }

  async add(input: {
    isbn: string
    title: string
    author: string
    libraryId: string
    publisher?: string
    publishedYear?: number
    coverImageUrl?: string
    description?: string
    subjects?: string[]
    quantity?: number
  }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const quantity = Math.max(1, input.quantity ?? 1)
    await this.db.insert(books).values({
      id,
      isbn: input.isbn,
      title: input.title,
      author: input.author,
      publisher: input.publisher ?? null,
      publishedYear: input.publishedYear ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      description: input.description ?? null,
      subjects: input.subjects ?? null,
      libraryId: input.libraryId,
      quantity,
      availableCount: quantity,
      isAvailable: quantity > 0,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  }

  async getById(bookId: string, libraryId: string) {
    return this.db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
      .get()
  }

  async getActiveBorrower(bookId: string, libraryId: string) {
    // A loan is held by EITHER a login `user` (app-created) OR a `member`
    // (imported from 番薯 — no login). Left-join both and coalesce so
    // member-backed loans still surface a borrower name.
    const row = await this.db
      .select({
        borrowerName: sql<string>`coalesce(${user.name}, ${members.name})`,
        borrowerEmail: sql<string | null>`coalesce(${user.email}, ${members.email})`,
        borrowedAt: borrowTransactions.borrowedAt,
        dueDate: borrowTransactions.dueDate,
      })
      .from(borrowTransactions)
      .leftJoin(user, eq(borrowTransactions.userId, user.id))
      .leftJoin(members, eq(borrowTransactions.memberId, members.id))
      .where(
        and(
          eq(borrowTransactions.bookId, bookId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .get()
    return row ?? null
  }

  async findByIsbn(isbnRaw: string, libraryId: string) {
    const isbn = isbnRaw.replace(/[^0-9Xx]/g, '').toUpperCase()
    if (!isbn) return undefined
    const matches = await this.db
      .select()
      .from(books)
      .where(and(eq(books.libraryId, libraryId), eq(books.isbn, isbn)))
      .all()
    if (matches.length === 0) return undefined
    return matches.find((b) => b.isAvailable) ?? matches[0]
  }

  async update(
    bookId: string,
    libraryId: string,
    fields: {
      title?: string
      author?: string
      isbn?: string
      publisher?: string | null
      publishedYear?: number | null
      coverImageUrl?: string | null
      description?: string | null
      subjects?: string[] | null
    },
  ) {
    const existing = await this.getById(bookId, libraryId)
    if (!existing) return { updated: false }
    await this.db
      .update(books)
      .set({ ...fields, updatedAt: new Date().toISOString() })
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
    return { updated: true }
  }

  async delete(bookId: string, libraryId: string) {
    const existing = await this.getById(bookId, libraryId)
    if (!existing) throw new Error('BOOK_NOT_FOUND')

    const activeBorrow = await this.db
      .select({ id: borrowTransactions.id })
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.bookId, bookId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .get()
    if (activeBorrow) throw new Error('BOOK_CURRENTLY_BORROWED')

    await this.db.delete(books).where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
    return { deleted: true }
  }
}

export class CirculationService {
  constructor(private db: Database) {}

  async borrow(bookId: string, userId: string, libraryId: string) {
    const book = await this.db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
      .get()

    if (!book) throw new Error('BOOK_NOT_FOUND')
    if (book.availableCount <= 0) throw new Error('BOOK_NOT_AVAILABLE')

    const library = await this.db.select().from(libraries).where(eq(libraries.id, libraryId)).get()
    const period = library?.settings.borrowingPeriodDays ?? DEFAULT_BORROW_DAYS
    const maxBooks = library?.settings.maxBooksPerReader ?? 5

    const activeLoans = await this.db
      .select({ dueDate: borrowTransactions.dueDate })
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.userId, userId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .all()

    const nowMs = Date.now()
    if (activeLoans.some((l) => new Date(l.dueDate).getTime() < nowMs)) {
      throw new Error('HAS_OVERDUE_BOOKS')
    }
    if (activeLoans.length >= maxBooks) {
      throw new Error('BORROW_LIMIT_REACHED')
    }

    const now = new Date()
    const due = new Date(now.getTime() + period * 24 * 60 * 60 * 1000)

    // Atomically claim a copy: the WHERE guard ensures a concurrent borrow that
    // already took the last copy can't be overwritten (read-modify-write race).
    // RETURNING tells us whether we actually acquired a copy.
    const claimed = await this.db
      .update(books)
      .set({
        availableCount: sql`${books.availableCount} - 1`,
        isAvailable: sql`CASE WHEN ${books.availableCount} - 1 > 0 THEN 1 ELSE 0 END`,
      })
      .where(and(eq(books.id, bookId), sql`${books.availableCount} > 0`))
      .returning({ availableCount: books.availableCount })
      .all()

    // No row updated → another request took the last copy between our read and
    // this write. Treat as unavailable (do NOT create a loan).
    if (claimed.length === 0) throw new Error('BOOK_NOT_AVAILABLE')

    await this.db.insert(borrowTransactions).values({
      id: crypto.randomUUID(),
      bookId,
      userId,
      libraryId,
      borrowedAt: now.toISOString(),
      dueDate: due.toISOString(),
    })

    return { dueDate: due.toISOString() }
  }

  async borrowByIsbn(isbn: string, userId: string, libraryId: string) {
    const bookSvc = new BookService(this.db)
    const book = await bookSvc.findByIsbn(isbn, libraryId)
    if (!book) throw new Error('BOOK_NOT_IN_LIBRARY')
    const res = await this.borrow(book.id, userId, libraryId)
    return { bookId: book.id, title: book.title, dueDate: res.dueDate }
  }

  async returnBook(transactionId: string, userId: string, libraryId: string) {
    // Guarded active→returned transition: only the request that flips a still-
    // active loan proceeds. RETURNING confirms we won the transition, so a
    // duplicate/concurrent return cannot credit inventory twice.
    const returned = await this.db
      .update(borrowTransactions)
      .set({ returnedAt: new Date().toISOString() })
      .where(
        and(
          eq(borrowTransactions.id, transactionId),
          eq(borrowTransactions.userId, userId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .returning({ bookId: borrowTransactions.bookId })
      .all()

    const row = returned[0]
    if (!row) throw new Error('INVALID_RETURN_REQUEST')
    const bookId = row.bookId

    // Credit the copy back atomically, capped at quantity (MIN guards against a
    // concurrent return pushing availableCount above the physical copy count).
    await this.db
      .update(books)
      .set({
        availableCount: sql`MIN(${books.availableCount} + 1, ${books.quantity})`,
        isAvailable: sql`CASE WHEN MIN(${books.availableCount} + 1, ${books.quantity}) > 0 THEN 1 ELSE 0 END`,
      })
      .where(eq(books.id, bookId))
      .run()

    return { success: true }
  }

  async myBooks(userId: string, libraryId: string) {
    const rows = await this.db
      .select({ tx: borrowTransactions, book: books })
      .from(borrowTransactions)
      .innerJoin(books, eq(borrowTransactions.bookId, books.id))
      .where(
        and(
          eq(borrowTransactions.userId, userId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .all()

    const now = Date.now()
    return rows.map((r) => ({
      transactionId: r.tx.id,
      bookId: r.book.id,
      title: r.book.title,
      author: r.book.author,
      coverImageUrl: r.book.coverImageUrl,
      borrowedAt: r.tx.borrowedAt,
      dueDate: r.tx.dueDate,
      isOverdue: new Date(r.tx.dueDate).getTime() < now,
    }))
  }

  async listOverdue(libraryId: string, range: '1-7' | '8-14' | '15+' | 'all' = 'all') {
    const rows = await this.db
      .select({
        tx: borrowTransactions,
        book: books,
        borrowerName: sql<string>`coalesce(${user.name}, ${members.name})`,
        borrowerEmail: sql<string | null>`coalesce(${user.email}, ${members.email})`,
      })
      .from(borrowTransactions)
      .innerJoin(books, eq(borrowTransactions.bookId, books.id))
      .leftJoin(user, eq(borrowTransactions.userId, user.id))
      .leftJoin(members, eq(borrowTransactions.memberId, members.id))
      .where(and(eq(borrowTransactions.libraryId, libraryId), isNull(borrowTransactions.returnedAt)))
      .all()

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    return rows
      .map((r) => {
        const daysOverdue = Math.floor((now - new Date(r.tx.dueDate).getTime()) / DAY)
        return {
          transactionId: r.tx.id,
          title: r.book.title,
          author: r.book.author,
          borrowerName: r.borrowerName,
          borrowerEmail: r.borrowerEmail,
          dueDate: r.tx.dueDate,
          daysOverdue,
        }
      })
      .filter((r) => r.daysOverdue >= 1)
      .filter((r) => {
        switch (range) {
          case '1-7':
            return r.daysOverdue >= 1 && r.daysOverdue <= 7
          case '8-14':
            return r.daysOverdue >= 8 && r.daysOverdue <= 14
          case '15+':
            return r.daysOverdue >= 15
          default:
            return true
        }
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
  }
}

export class LibraryService {
  constructor(private db: Database) {}

  async get(libraryId: string) {
    return this.db.select().from(libraries).where(eq(libraries.id, libraryId)).get()
  }

  async updateSettings(
    libraryId: string,
    input: {
      name?: string
      borrowingPeriodDays?: number
      maxBooksPerReader?: number
      allowExtensions?: boolean
    },
  ) {
    const lib = await this.get(libraryId)
    if (!lib) throw new Error('LIBRARY_NOT_FOUND')

    const settings: LibrarySettings = {
      borrowingPeriodDays: input.borrowingPeriodDays ?? lib.settings.borrowingPeriodDays,
      maxBooksPerReader: input.maxBooksPerReader ?? lib.settings.maxBooksPerReader,
      allowExtensions: input.allowExtensions ?? lib.settings.allowExtensions,
    }
    await this.db
      .update(libraries)
      .set({ name: input.name ?? lib.name, settings, updatedAt: new Date().toISOString() })
      .where(eq(libraries.id, libraryId))
    return { name: input.name ?? lib.name, settings }
  }
}

export class FeedbackService {
  constructor(private db: Database) {}

  async submit(input: {
    libraryId: string
    userId: string
    category: 'feature_request' | 'bug' | 'book_suggestion' | 'other'
    message: string
  }) {
    const id = crypto.randomUUID()
    await this.db.insert(feedback).values({
      id,
      libraryId: input.libraryId,
      userId: input.userId,
      category: input.category,
      message: input.message,
      status: 'new',
      createdAt: new Date().toISOString(),
    })
    return { id }
  }

  async listByLibrary(libraryId: string) {
    const rows = await this.db
      .select({ fb: feedback, submitter: user })
      .from(feedback)
      .innerJoin(user, eq(feedback.userId, user.id))
      .where(eq(feedback.libraryId, libraryId))
      .orderBy(desc(feedback.createdAt))
      .all()
    return rows.map((r) => ({
      id: r.fb.id,
      category: r.fb.category,
      message: r.fb.message,
      status: r.fb.status,
      createdAt: r.fb.createdAt,
      submitterName: r.submitter.name,
      submitterEmail: r.submitter.email,
    }))
  }
}


/**
 * Super-admin only: manage libraries (tenants) across the whole system.
 * NOT tenant-scoped — these intentionally span all libraries.
 */
export class TenantAdminService {
  constructor(private db: Database) {}

  // All libraries with lightweight counts (books, members).
  async listAll() {
    const libs = await this.db.select().from(libraries).orderBy(desc(libraries.createdAt)).all()

    const bookCounts = await this.db
      .select({ libraryId: books.libraryId, count: sql<number>`count(*)` })
      .from(books)
      .groupBy(books.libraryId)
      .all()
    const memberCounts = await this.db
      .select({ libraryId: user.libraryId, count: sql<number>`count(*)` })
      .from(user)
      .groupBy(user.libraryId)
      .all()

    const bookBy = new Map(bookCounts.map((r) => [r.libraryId, r.count]))
    const memberBy = new Map(memberCounts.map((r) => [r.libraryId, r.count]))

    return libs.map((l) => ({
      id: l.id,
      name: l.name,
      emailDomains: l.emailDomains,
      isActive: l.isActive,
      createdAt: l.createdAt,
      bookCount: bookBy.get(l.id) ?? 0,
      memberCount: memberBy.get(l.id) ?? 0,
    }))
  }

  // Create a new library (tenant).
  async create(input: { name: string; emailDomains: string[] }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await this.db.insert(libraries).values({
      id,
      name: input.name,
      emailDomains: input.emailDomains,
      settings: { borrowingPeriodDays: 14, maxBooksPerReader: 5, allowExtensions: false },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  }

  // Activate / deactivate a library.
  async setActive(libraryId: string, isActive: boolean) {
    await this.db
      .update(libraries)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(eq(libraries.id, libraryId))
    return { id: libraryId, isActive }
  }
}
