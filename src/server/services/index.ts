import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import { books, borrowTransactions, libraries, users } from '@/db/schema'

const DEFAULT_BORROW_DAYS = 14

export class BookService {
  constructor(private db: Db) {}

  // ALWAYS scoped by libraryId (multi-tenant isolation).
  async listByLibrary(libraryId: string) {
    return this.db.select().from(books).where(eq(books.libraryId, libraryId)).all()
  }

  async add(input: { isbn: string; title: string; author: string; libraryId: string }) {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await this.db.insert(books).values({
      id,
      isbn: input.isbn,
      title: input.title,
      author: input.author,
      libraryId: input.libraryId,
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    })
    return { id }
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
      borrowedAt: r.tx.borrowedAt,
      dueDate: r.tx.dueDate,
      isOverdue: new Date(r.tx.dueDate).getTime() < now,
    }))
  }
}

export class UserService {
  constructor(private db: Db) {}

  async findByEmail(email: string) {
    return this.db.select().from(users).where(eq(users.email, email)).get()
  }
}
