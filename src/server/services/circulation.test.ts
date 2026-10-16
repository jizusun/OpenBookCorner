import { describe, it, expect, beforeEach } from 'vitest'
import { BookService, CirculationService } from './index'
import { createTestDb, seedBook, seedLibrary, seedUser } from './testdb'
import { borrowTransactions } from '@/db/schema'
import type { Db } from '@/db'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'
const READER_A = 'reader-a'
const READER_B = 'reader-b'
const BOOK_A = 'book-a'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, READER_A, LIB_A)
  await seedUser(db, READER_B, LIB_B)
  await seedBook(db, BOOK_A, LIB_A)
})

describe('BookService (tenant scoping)', () => {
  it('lists only books from the requested library', async () => {
    await seedBook(db, 'book-b', LIB_B)
    const svc = new BookService(db)
    const booksA = await svc.listByLibrary(LIB_A)
    expect(booksA.items).toHaveLength(1)
    expect(booksA.items[0].id).toBe(BOOK_A)
    expect(booksA.total).toBe(1)
  })

  it('does NOT leak books across tenants', async () => {
    const svc = new BookService(db)
    const booksB = await svc.listByLibrary(LIB_B)
    expect(booksB.items).toHaveLength(0) // BOOK_A belongs to LIB_A
    expect(booksB.total).toBe(0)
  })

  it('filters by search term (title/author), tenant-scoped', async () => {
    const svc = new BookService(db)
    // BOOK_A title is "Book book-a", author "Author"
    const hit = await svc.listByLibrary(LIB_A, { search: 'book-a' })
    expect(hit.items).toHaveLength(1)
    const miss = await svc.listByLibrary(LIB_A, { search: 'nonexistent-xyz' })
    expect(miss.items).toHaveLength(0)
    expect(miss.total).toBe(0)
  })

  it('paginates results', async () => {
    const svc = new BookService(db)
    for (let i = 0; i < 24; i++) await seedBook(db, `pg-${i}`, LIB_A)
    const p1 = await svc.listByLibrary(LIB_A, { page: 1, limit: 10 })
    expect(p1.items).toHaveLength(10)
    expect(p1.total).toBe(25) // 24 + BOOK_A
    expect(p1.totalPages).toBe(3)
    const p3 = await svc.listByLibrary(LIB_A, { page: 3, limit: 10 })
    expect(p3.items).toHaveLength(5)
  })
})

describe('CirculationService.borrow', () => {
  it('borrows an available book, marks it unavailable, sets a due date', async () => {
    const svc = new CirculationService(db)
    const res = await svc.borrow(BOOK_A, READER_A, LIB_A)
    expect(res.dueDate).toBeTruthy()

    const books = await new BookService(db).listByLibrary(LIB_A)
    expect(books.items[0].isAvailable).toBe(false)

    const mine = await svc.myBooks(READER_A, LIB_A)
    expect(mine).toHaveLength(1)
    expect(mine[0].bookId).toBe(BOOK_A)
  })

  // --- Negation tests ---
  it('rejects borrowing a book that does not exist', async () => {
    const svc = new CirculationService(db)
    await expect(svc.borrow('nope', READER_A, LIB_A)).rejects.toThrow('BOOK_NOT_FOUND')
  })

  it('rejects borrowing an already-borrowed book', async () => {
    const svc = new CirculationService(db)
    await svc.borrow(BOOK_A, READER_A, LIB_A)
    await expect(svc.borrow(BOOK_A, READER_A, LIB_A)).rejects.toThrow('BOOK_NOT_AVAILABLE')
  })

  it('rejects cross-tenant borrow (tenant B cannot borrow tenant A book)', async () => {
    const svc = new CirculationService(db)
    // Book A belongs to LIB_A; attempting to borrow it scoped to LIB_B must fail.
    await expect(svc.borrow(BOOK_A, READER_B, LIB_B)).rejects.toThrow('BOOK_NOT_FOUND')
  })
})

describe('CirculationService.returnBook', () => {
  it('returns a borrowed book and makes it available again', async () => {
    const svc = new CirculationService(db)
    await svc.borrow(BOOK_A, READER_A, LIB_A)
    const mine = await svc.myBooks(READER_A, LIB_A)
    const txId = mine[0].transactionId

    const res = await svc.returnBook(txId, READER_A, LIB_A)
    expect(res.success).toBe(true)

    const books = await new BookService(db).listByLibrary(LIB_A)
    expect(books.items[0].isAvailable).toBe(true)
    expect(await svc.myBooks(READER_A, LIB_A)).toHaveLength(0)
  })

  // --- Negation tests ---
  it('rejects returning a non-existent transaction', async () => {
    const svc = new CirculationService(db)
    await expect(svc.returnBook('nope', READER_A, LIB_A)).rejects.toThrow('INVALID_RETURN_REQUEST')
  })

  it('rejects a double return of the same transaction', async () => {
    const svc = new CirculationService(db)
    await svc.borrow(BOOK_A, READER_A, LIB_A)
    const txId = (await svc.myBooks(READER_A, LIB_A))[0].transactionId
    await svc.returnBook(txId, READER_A, LIB_A)
    await expect(svc.returnBook(txId, READER_A, LIB_A)).rejects.toThrow('INVALID_RETURN_REQUEST')
  })

  it('rejects another user returning your borrowed book', async () => {
    const svc = new CirculationService(db)
    await svc.borrow(BOOK_A, READER_A, LIB_A)
    const txId = (await svc.myBooks(READER_A, LIB_A))[0].transactionId
    // READER_B (different user/tenant) must not be able to return READER_A's transaction.
    await expect(svc.returnBook(txId, READER_B, LIB_B)).rejects.toThrow('INVALID_RETURN_REQUEST')
  })
})

describe('CirculationService.borrow — business rules', () => {
  it('blocks borrowing once the per-reader limit is reached', async () => {
    const svc = new CirculationService(db)
    // seedLibrary default maxBooksPerReader = 5
    for (let i = 0; i < 5; i++) {
      await seedBook(db, `lim-${i}`, LIB_A)
      await svc.borrow(`lim-${i}`, READER_A, LIB_A)
    }
    await seedBook(db, 'lim-extra', LIB_A)
    await expect(svc.borrow('lim-extra', READER_A, LIB_A)).rejects.toThrow('BORROW_LIMIT_REACHED')
  })

  it('blocks borrowing while the reader has an overdue book', async () => {
    const svc = new CirculationService(db)
    // Create an overdue active loan directly.
    const DAY = 24 * 60 * 60 * 1000
    const past = new Date(Date.now() - 3 * DAY).toISOString()
    await db.insert(borrowTransactions).values({
      id: 'overdue-tx',
      bookId: BOOK_A,
      userId: READER_A,
      libraryId: LIB_A,
      borrowedAt: new Date(Date.now() - 20 * DAY).toISOString(),
      dueDate: past,
      returnedAt: null,
    })
    await seedBook(db, 'another', LIB_A)
    await expect(svc.borrow('another', READER_A, LIB_A)).rejects.toThrow('HAS_OVERDUE_BOOKS')
  })

  it('allows borrowing when under limit and no overdue books', async () => {
    const svc = new CirculationService(db)
    await seedBook(db, 'ok-book', LIB_A)
    await expect(svc.borrow('ok-book', READER_A, LIB_A)).resolves.toHaveProperty('dueDate')
  })
})

describe('CirculationService.borrowByIsbn (scan-to-borrow)', () => {
  it('borrows a catalog book by its ISBN', async () => {
    // seedBook sets isbn '9780000000001'
    const svc = new CirculationService(db)
    const res = await svc.borrowByIsbn('9780000000001', READER_A, LIB_A)
    expect(res).toMatchObject({ bookId: BOOK_A })
    expect(res.dueDate).toBeTruthy()
    const mine = await svc.myBooks(READER_A, LIB_A)
    expect(mine.some((m) => m.bookId === BOOK_A)).toBe(true)
  })

  it('normalizes dashed ISBN input', async () => {
    const svc = new CirculationService(db)
    const res = await svc.borrowByIsbn('978-0-00-000000-1', READER_A, LIB_A)
    expect(res.bookId).toBe(BOOK_A)
  })

  // --- Negation ---
  it('rejects an ISBN not in the library catalog', async () => {
    const svc = new CirculationService(db)
    await expect(svc.borrowByIsbn('9789999999999', READER_A, LIB_A)).rejects.toThrow('BOOK_NOT_IN_LIBRARY')
  })

  it('rejects when the matched book is already borrowed', async () => {
    const svc = new CirculationService(db)
    await svc.borrow(BOOK_A, READER_A, LIB_A)
    await expect(svc.borrowByIsbn('9780000000001', READER_A, LIB_A)).rejects.toThrow('BOOK_NOT_AVAILABLE')
  })

  it('is tenant-scoped (ISBN in another library is not borrowable)', async () => {
    const svc = new CirculationService(db)
    // BOOK_A/isbn belongs to LIB_A; READER_B is in LIB_B
    await expect(svc.borrowByIsbn('9780000000001', READER_B, LIB_B)).rejects.toThrow('BOOK_NOT_IN_LIBRARY')
  })
})
