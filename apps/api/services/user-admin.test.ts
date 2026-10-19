import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { UserAdminService } from './user-admin'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  // Acme: one reader, one admin. Globex: one reader. Plus a system super admin.
  await seedUser(db, 'alice', LIB_A, 'library_reader')
  await seedUser(db, 'bob', LIB_A, 'library_admin')
  await seedUser(db, 'carol', LIB_B, 'library_reader')
  await seedUser(db, 'root', null as unknown as string, 'super_admin')
})

describe('UserAdminService.listAll', () => {
  it('lists users across ALL tenants with their library name + role', async () => {
    const svc = new UserAdminService(db)
    const { items, total } = await svc.listAll({})
    expect(total).toBe(4)
    const alice = items.find((u) => u.id === 'alice')!
    expect(alice.email).toBe('alice@test.com')
    expect(alice.role).toBe('library_reader')
    expect(alice.libraryId).toBe(LIB_A)
    // library name resolved via join
    expect(alice.libraryName).toBeTruthy()
    // a super admin with no library resolves to null name, not a crash
    const root = items.find((u) => u.id === 'root')!
    expect(root.libraryId).toBeNull()
    expect(root.libraryName).toBeNull()
  })

  it('filters by a case-insensitive search on name/email', async () => {
    const svc = new UserAdminService(db)
    const { items } = await svc.listAll({ search: 'alice' })
    expect(items.map((u) => u.id)).toEqual(['alice'])

    const byEmail = await svc.listAll({ search: 'carol@test' })
    expect(byEmail.items.map((u) => u.id)).toEqual(['carol'])
  })

  it('paginates with limit/offset and reports the unfiltered total', async () => {
    const svc = new UserAdminService(db)
    const page1 = await svc.listAll({ limit: 2, page: 1 })
    expect(page1.items).toHaveLength(2)
    expect(page1.total).toBe(4)
    const page2 = await svc.listAll({ limit: 2, page: 2 })
    expect(page2.items).toHaveLength(2)
    // no overlap between pages
    const ids = new Set([...page1.items, ...page2.items].map((u) => u.id))
    expect(ids.size).toBe(4)
  })

  it('search total reflects the filtered count', async () => {
    const svc = new UserAdminService(db)
    const res = await svc.listAll({ search: '@test.com' })
    // all four share @test.com
    expect(res.total).toBe(4)
  })
})
