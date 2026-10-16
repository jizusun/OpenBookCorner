import { describe, it, expect, beforeEach } from 'vitest'
import { CirculationService } from './index'
import { createTestDb, seedBook, seedLibrary, seedUser } from './testdb'
import { borrowTransactions } from '@/db/schema'
import type { Db } from '@/db'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'
const READER_A = 'reader-a'
const READER_B = 'reader-b'

let db: Db

const DAY = 24 * 60 * 60 * 1000

async function addTx(
  db: Db,
  opts: {
    id: string
    bookId: string
    userId: string
    libraryId: string
    daysOverdue: number
    returned?: boolean
  },
) {
  const now = Date.now()
  const dueDate = new Date(now - opts.daysOverdue * DAY).toISOString()
  await db.insert(borrowTransactions).values({
    id: opts.id,
    bookId: opts.bookId,
    userId: opts.userId,
    libraryId: opts.libraryId,
    borrowedAt: new Date(now - (opts.daysOverdue + 14) * DAY).toISOString(),
    dueDate,
    returnedAt: opts.returned ? new Date().toISOString() : null,
  })
}

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, READER_A, LIB_A)
  await seedUser(db, READER_B, LIB_B)
  await seedBook(db, 'book-1', LIB_A)
  await seedBook(db, 'book-2', LIB_A)
  await seedBook(db, 'book-3', LIB_A)
  await seedBook(db, 'book-b', LIB_B)
})

describe('CirculationService.listOverdue', () => {
  it('returns overdue books with borrower contact and days overdue (desc)', async () => {
    await addTx(db, { id: 't1', bookId: 'book-1', userId: READER_A, libraryId: LIB_A, daysOverdue: 3 })
    await addTx(db, { id: 't2', bookId: 'book-2', userId: READER_A, libraryId: LIB_A, daysOverdue: 20 })

    const svc = new CirculationService(db)
    const overdue = await svc.listOverdue(LIB_A, 'all')

    expect(overdue).toHaveLength(2)
    // sorted by daysOverdue desc
    expect(overdue[0].daysOverdue).toBeGreaterThanOrEqual(overdue[1].daysOverdue)
    expect(overdue[0]).toMatchObject({ borrowerName: READER_A, borrowerEmail: `${READER_A}@test.com` })
  })

  it('filters by day range', async () => {
    await addTx(db, { id: 'a', bookId: 'book-1', userId: READER_A, libraryId: LIB_A, daysOverdue: 3 })
    await addTx(db, { id: 'b', bookId: 'book-2', userId: READER_A, libraryId: LIB_A, daysOverdue: 10 })
    await addTx(db, { id: 'c', bookId: 'book-3', userId: READER_A, libraryId: LIB_A, daysOverdue: 20 })
    const svc = new CirculationService(db)

    expect(await svc.listOverdue(LIB_A, '1-7')).toHaveLength(1)
    expect(await svc.listOverdue(LIB_A, '8-14')).toHaveLength(1)
    expect(await svc.listOverdue(LIB_A, '15+')).toHaveLength(1)
    expect(await svc.listOverdue(LIB_A, 'all')).toHaveLength(3)
  })

  // --- Negation / isolation ---
  it('excludes returned books', async () => {
    await addTx(db, { id: 'r', bookId: 'book-1', userId: READER_A, libraryId: LIB_A, daysOverdue: 10, returned: true })
    const svc = new CirculationService(db)
    expect(await svc.listOverdue(LIB_A, 'all')).toHaveLength(0)
  })

  it('excludes not-yet-overdue books (negative days)', async () => {
    await addTx(db, { id: 'future', bookId: 'book-1', userId: READER_A, libraryId: LIB_A, daysOverdue: -5 })
    const svc = new CirculationService(db)
    expect(await svc.listOverdue(LIB_A, 'all')).toHaveLength(0)
  })

  it('is tenant-scoped (does not leak other libraries overdue books)', async () => {
    await addTx(db, { id: 'a', bookId: 'book-1', userId: READER_A, libraryId: LIB_A, daysOverdue: 5 })
    await addTx(db, { id: 'b', bookId: 'book-b', userId: READER_B, libraryId: LIB_B, daysOverdue: 5 })
    const svc = new CirculationService(db)
    expect(await svc.listOverdue(LIB_A, 'all')).toHaveLength(1)
    expect(await svc.listOverdue(LIB_B, 'all')).toHaveLength(1)
  })
})
