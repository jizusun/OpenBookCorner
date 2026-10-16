import { describe, it, expect, beforeEach } from 'vitest'
import { BookService, CirculationService } from './index'
import { createTestDb, seedBook, seedLibrary, seedUser } from './testdb'
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
    expect(booksA).toHaveLength(1)
    expect(booksA[0].id).toBe(BOOK_A)
  })

  it('does NOT leak books across tenants', async () => {
    const svc = new BookService(db)
    const booksB = await svc.listByLibrary(LIB_B)
    expect(booksB).toHaveLength(0) // BOOK_A belongs to LIB_A
  })
})

describe('CirculationService.borrow', () => {
  it('borrows an available book, marks it unavailable, sets a due date', async () => {
    const svc = new CirculationService(db)
    const res = await svc.borrow(BOOK_A, READER_A, LIB_A)
    expect(res.dueDate).toBeTruthy()

    const books = await new BookService(db).listByLibrary(LIB_A)
    expect(books[0].isAvailable).toBe(false)

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
    expect(books[0].isAvailable).toBe(true)
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
