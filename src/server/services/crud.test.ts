import { describe, it, expect, beforeEach } from 'vitest'
import { BookService, CirculationService, LibraryService } from './index'
import { createTestDb, seedBook, seedLibrary, seedUser } from './testdb'
import type { Db } from '@/db'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'
const READER_A = 'reader-a'
const BOOK_A = 'book-a'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, READER_A, LIB_A)
  await seedBook(db, BOOK_A, LIB_A)
})

describe('BookService.update', () => {
  it('updates editable fields, tenant-scoped', async () => {
    const svc = new BookService(db)
    const res = await svc.update(BOOK_A, LIB_A, { title: 'New Title', publisher: 'ACME' })
    expect(res.updated).toBe(true)
    const book = await svc.getById(BOOK_A, LIB_A)
    expect(book?.title).toBe('New Title')
    expect(book?.publisher).toBe('ACME')
  })

  // --- Negation ---
  it('does not update a book from another tenant', async () => {
    const svc = new BookService(db)
    const res = await svc.update(BOOK_A, LIB_B, { title: 'Hijack' })
    expect(res.updated).toBe(false)
    expect((await svc.getById(BOOK_A, LIB_A))?.title).not.toBe('Hijack')
  })
})

describe('BookService.delete', () => {
  it('deletes a book, tenant-scoped', async () => {
    const svc = new BookService(db)
    const res = await svc.delete(BOOK_A, LIB_A)
    expect(res.deleted).toBe(true)
    expect(await svc.getById(BOOK_A, LIB_A)).toBeFalsy()
  })

  // --- Negation ---
  it('blocks deletion while the book is actively borrowed', async () => {
    const circ = new CirculationService(db)
    await circ.borrow(BOOK_A, READER_A, LIB_A)
    const svc = new BookService(db)
    await expect(svc.delete(BOOK_A, LIB_A)).rejects.toThrow('BOOK_CURRENTLY_BORROWED')
    expect(await svc.getById(BOOK_A, LIB_A)).toBeTruthy() // still there
  })

  it('allows deletion after the book is returned', async () => {
    const circ = new CirculationService(db)
    await circ.borrow(BOOK_A, READER_A, LIB_A)
    const tx = (await circ.myBooks(READER_A, LIB_A))[0].transactionId
    await circ.returnBook(tx, READER_A, LIB_A)
    const svc = new BookService(db)
    await expect(svc.delete(BOOK_A, LIB_A)).resolves.toMatchObject({ deleted: true })
  })

  it('rejects deleting a non-existent / cross-tenant book', async () => {
    const svc = new BookService(db)
    await expect(svc.delete(BOOK_A, LIB_B)).rejects.toThrow('BOOK_NOT_FOUND')
  })
})

describe('LibraryService.updateSettings', () => {
  it('merges updates onto existing settings', async () => {
    const svc = new LibraryService(db)
    const res = await svc.updateSettings(LIB_A, { borrowingPeriodDays: 21 })
    expect(res.settings.borrowingPeriodDays).toBe(21)
    // unchanged fields preserved
    expect(res.settings.maxBooksPerReader).toBe(5)
    expect(res.settings.allowExtensions).toBe(false)
    const lib = await svc.get(LIB_A)
    expect(lib?.settings.borrowingPeriodDays).toBe(21)
  })

  it('updates the library name', async () => {
    const svc = new LibraryService(db)
    const res = await svc.updateSettings(LIB_A, { name: 'Renamed Library' })
    expect(res.name).toBe('Renamed Library')
    expect((await svc.get(LIB_A))?.name).toBe('Renamed Library')
  })

  // --- Negation ---
  it('throws for a non-existent library', async () => {
    const svc = new LibraryService(db)
    await expect(svc.updateSettings('nope', { name: 'x' })).rejects.toThrow('LIBRARY_NOT_FOUND')
  })
})
