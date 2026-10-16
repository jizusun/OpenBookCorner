import { and, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { books, borrowTransactions, feedback, libraries, users, type LibrarySettings } from '@/db/schema'

const DEFAULT_BORROW_DAYS = 14

export class BookService {
  constructor(private db: Db) {}

  // ALWAYS scoped by libraryId (multi-tenant isolation). Supports optional
  // search (title/author) and pagination. Returns items + total count.
  async listByLibrary(
    libraryId: string,
    opts: { search?: string; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1)
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
    const offset = (page - 1) * limit

    const search = opts.search?.trim()
    const searchFilter = search
      ? or(like(books.title, `%${search}%`), like(books.author, `%${search}%`))
      : undefined
    const where = and(eq(books.libraryId, libraryId), searchFilter)

    const items = await this.db
      .select()
      .from(books)
      .where(where)
      .orderBy(desc(books.createdAt))
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
  }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
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
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
  }

  // Single book by id, tenant-scoped (for the detail/discovery page).
  async getById(bookId: string, libraryId: string) {
    return this.db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
      .get()
  }

  // Update editable fields of a book, tenant-scoped. Returns false if not found.
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

  // Delete a book, tenant-scoped. Blocks deletion while an active (unreturned) borrow exists.
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

    await this.db
      .delete(books)
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
    return { deleted: true }
  }
}

export class CirculationService {
  constructor(private db: Db) {}

  async borrow(bookId: string, userId: string, libraryId: string) {
    const book = await this.db
      .select()
      .from(books)
      .where(and(eq(books.id, bookId), eq(books.libraryId, libraryId)))
      .get()

    if (!book) throw new Error('BOOK_NOT_FOUND')
    if (!book.isAvailable) throw new Error('BOOK_NOT_AVAILABLE')

    const library = await this.db.select().from(libraries).where(eq(libraries.id, libraryId)).get()
    const period = library?.settings.borrowingPeriodDays ?? DEFAULT_BORROW_DAYS
    const maxBooks = library?.settings.maxBooksPerReader ?? 5

    // Business rules: a reader cannot exceed the per-reader limit, and cannot borrow
    // while they have any overdue book outstanding.
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

    await this.db.batch([
      this.db.update(books).set({ isAvailable: false }).where(eq(books.id, bookId)),
      this.db.insert(borrowTransactions).values({
        id: crypto.randomUUID(),
        bookId,
        userId,
        libraryId,
        borrowedAt: now.toISOString(),
        dueDate: due.toISOString(),
      }),
    ])

    return { dueDate: due.toISOString() }
  }

  async returnBook(transactionId: string, userId: string, libraryId: string) {
    const tx = await this.db
      .select()
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.id, transactionId),
          eq(borrowTransactions.userId, userId),
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .get()

    if (!tx) throw new Error('INVALID_RETURN_REQUEST')

    await this.db.batch([
      this.db
        .update(borrowTransactions)
        .set({ returnedAt: new Date().toISOString() })
        .where(eq(borrowTransactions.id, transactionId)),
      this.db.update(books).set({ isAvailable: true }).where(eq(books.id, tx.bookId)),
    ])

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

  // Overdue books for a library (admin view). Tenant-scoped; excludes returned books.
  // `range` filters by days overdue: '1-7', '8-14', '15+', or 'all'.
  async listOverdue(libraryId: string, range: '1-7' | '8-14' | '15+' | 'all' = 'all') {
    const rows = await this.db
      .select({ tx: borrowTransactions, book: books, user: users })
      .from(borrowTransactions)
      .innerJoin(books, eq(borrowTransactions.bookId, books.id))
      .innerJoin(users, eq(borrowTransactions.userId, users.id))
      .where(
        and(
          eq(borrowTransactions.libraryId, libraryId),
          isNull(borrowTransactions.returnedAt),
        ),
      )
      .all()

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    const overdue = rows
      .map((r) => {
        const daysOverdue = Math.floor((now - new Date(r.tx.dueDate).getTime()) / DAY)
        return {
          transactionId: r.tx.id,
          title: r.book.title,
          author: r.book.author,
          borrowerName: r.user.name,
          borrowerEmail: r.user.email,
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

    return overdue
  }
}

export class UserService {
  constructor(private db: Db) {}

  async findByEmail(email: string) {
    return this.db.select().from(users).where(eq(users.email, email)).get()
  }
}

export class LibraryService {
  constructor(private db: Db) {}

  async get(libraryId: string) {
    return this.db.select().from(libraries).where(eq(libraries.id, libraryId)).get()
  }

  // Update library name and borrowing-policy settings (tenant-scoped, admin-gated upstream).
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
      .set({
        name: input.name ?? lib.name,
        settings,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(libraries.id, libraryId))
    return { name: input.name ?? lib.name, settings }
  }
}

export class FeedbackService {
  constructor(private db: Db) {}

  // Submit feedback (any authenticated member), tenant + user scoped.
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

  // List feedback for a library (admin), newest first, with submitter name/email.
  async listByLibrary(libraryId: string) {
    const rows = await this.db
      .select({ fb: feedback, user: users })
      .from(feedback)
      .innerJoin(users, eq(feedback.userId, users.id))
      .where(eq(feedback.libraryId, libraryId))
      .orderBy(desc(feedback.createdAt))
      .all()
    return rows.map((r) => ({
      id: r.fb.id,
      category: r.fb.category,
      message: r.fb.message,
      status: r.fb.status,
      createdAt: r.fb.createdAt,
      submitterName: r.user.name,
      submitterEmail: r.user.email,
    }))
  }
}
