import { describe, it, expect, beforeEach } from 'vitest'
import { FeedbackService } from './index'
import { createTestDb, seedLibrary, seedUser } from './testdb'
import type { Db } from '@/db'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'
const READER_A = 'reader-a'
const READER_B = 'reader-b'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, READER_A, LIB_A)
  await seedUser(db, READER_B, LIB_B)
})

describe('FeedbackService', () => {
  it('submits feedback and lists it with submitter info', async () => {
    const svc = new FeedbackService(db)
    await svc.submit({ libraryId: LIB_A, userId: READER_A, category: 'feature_request', message: 'Add reservations' })

    const list = await svc.listByLibrary(LIB_A)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      category: 'feature_request',
      message: 'Add reservations',
      status: 'new',
      submitterName: READER_A,
      submitterEmail: `${READER_A}@test.com`,
    })
  })

  it('lists newest first', async () => {
    const svc = new FeedbackService(db)
    await svc.submit({ libraryId: LIB_A, userId: READER_A, category: 'other', message: 'first' })
    await new Promise((r) => setTimeout(r, 5))
    await svc.submit({ libraryId: LIB_A, userId: READER_A, category: 'other', message: 'second' })
    const list = await svc.listByLibrary(LIB_A)
    expect(list[0].message).toBe('second')
  })

  // --- Isolation ---
  it('is tenant-scoped (does not leak other libraries feedback)', async () => {
    const svc = new FeedbackService(db)
    await svc.submit({ libraryId: LIB_A, userId: READER_A, category: 'bug', message: 'A-only' })
    await svc.submit({ libraryId: LIB_B, userId: READER_B, category: 'bug', message: 'B-only' })
    expect(await svc.listByLibrary(LIB_A)).toHaveLength(1)
    expect((await svc.listByLibrary(LIB_A))[0].message).toBe('A-only')
    expect(await svc.listByLibrary(LIB_B)).toHaveLength(1)
  })
})
