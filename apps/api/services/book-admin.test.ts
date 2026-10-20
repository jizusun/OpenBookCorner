import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedBook } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { BookAdminService } from './book-admin'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedBook(db, 'clean', LIB_A, '9780132350884')
  await seedBook(db, 'refactor', LIB_A, '9780201485677')
  await seedBook(db, 'ddd', LIB_B, '9780321125217')
})

describe('BookAdminService.listAll', () => {
  it('lists books across ALL tenants with resolved library name', async () => {
    const svc = new BookAdminService(db)
    const { items, total } = await svc.listAll({})
    expect(total).toBe(3)
    const libs = new Set(items.map((b) => b.libraryId))
    expect(libs.has(LIB_A)).toBe(true)
    expect(libs.has(LIB_B)).toBe(true)
    expect(items[0].libraryName).toBeTruthy()
    expect(items.find((b) => b.id === 'clean')!.title).toBe('Book clean')
  })

  it('filters by case-insensitive search on title/author/isbn', async () => {
    const svc = new BookAdminService(db)
    expect((await svc.listAll({ search: 'book clean' })).items.map((b) => b.id)).toEqual(['clean'])
    expect((await svc.listAll({ search: '9780201485677' })).items.map((b) => b.id)).toEqual(['refactor'])
  })

  it('paginates with limit/offset and reports the unfiltered total', async () => {
    const svc = new BookAdminService(db)
    const p1 = await svc.listAll({ limit: 2, page: 1 })
    expect(p1.items).toHaveLength(2)
    expect(p1.total).toBe(3)
    const p2 = await svc.listAll({ limit: 2, page: 2 })
    expect(p2.items).toHaveLength(1)
  })
})
