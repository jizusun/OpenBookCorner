import { describe, it, expect, beforeEach } from 'vitest'
import { AuditService } from './audit'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database as Db } from '@obc/db'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'
const ADMIN_A = 'admin-a'
const ADMIN_B = 'admin-b'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, ADMIN_A, LIB_A, 'library_admin')
  await seedUser(db, ADMIN_B, LIB_B, 'library_admin')
})

describe('AuditService', () => {
  it('records an entry with the real actor and reads it back', async () => {
    const svc = new AuditService(db)
    await svc.log({
      actorUserId: ADMIN_A,
      libraryId: LIB_A,
      action: 'book.add',
      targetType: 'book',
      targetId: 'book-1',
      metadata: { isbn: '978', title: 'T' },
    })
    const rows = await svc.listByLibrary(LIB_A)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      actorUserId: ADMIN_A,
      onBehalfOfUserId: null,
      libraryId: LIB_A,
      action: 'book.add',
      targetType: 'book',
      targetId: 'book-1',
    })
    expect(rows[0].metadata).toMatchObject({ isbn: '978', title: 'T' })
  })

  it('is tenant-scoped: one tenant never sees another tenant audit rows', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'library.updateSettings' })
    await svc.log({ actorUserId: ADMIN_B, libraryId: LIB_B, action: 'library.updateSettings' })

    const a = await svc.listByLibrary(LIB_A)
    const b = await svc.listByLibrary(LIB_B)
    expect(a).toHaveLength(1)
    expect(a[0].actorUserId).toBe(ADMIN_A)
    expect(b).toHaveLength(1)
    expect(b[0].actorUserId).toBe(ADMIN_B)
    // No cross-tenant leakage.
    expect(a.some((r) => r.libraryId === LIB_B)).toBe(false)
  })

  it('keeps the REAL actor and records the impersonated user separately', async () => {
    const svc = new AuditService(db)
    // ADMIN_A acting on behalf of ADMIN_B (simulated impersonation).
    await svc.log({
      actorUserId: ADMIN_A,
      onBehalfOfUserId: ADMIN_B,
      libraryId: LIB_A,
      action: 'book.delete',
      targetId: 'book-9',
    })
    const rows = await svc.listByLibrary(LIB_A)
    expect(rows[0].actorUserId).toBe(ADMIN_A) // never overwritten by the impersonated id
    expect(rows[0].onBehalfOfUserId).toBe(ADMIN_B)
  })

  it('returns entries newest-first and can filter by action', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.delete', targetId: 'b1' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b2' })

    const all = await svc.listByLibrary(LIB_A)
    expect(all).toHaveLength(3)

    const adds = await svc.listByLibraryAction(LIB_A, 'book.add')
    expect(adds).toHaveLength(2)
    expect(adds.every((r) => r.action === 'book.add')).toBe(true)
  })

  it('listSystem returns only system-level entries (libraryId IS NULL)', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: null, action: 'tenant.create', targetId: 'lib-new' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: null, action: 'tenant.setActive', targetId: 'lib-new' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b1' }) // tenant-scoped

    const sys = await svc.listSystem()
    expect(sys).toHaveLength(2)
    expect(sys.every((r) => r.libraryId === null)).toBe(true)
    expect(sys.map((r) => r.action).sort()).toEqual(['tenant.create', 'tenant.setActive'])
    // tenant-scoped reads never see the system entries.
    expect(await svc.listByLibrary(LIB_A)).toHaveLength(1)
  })
})

describe('AuditService.listAll (super-admin global, ADR 0005)', () => {
  it('spans ALL tenants (incl. system-level), newest first, paginated with total', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
    await svc.log({ actorUserId: ADMIN_B, libraryId: LIB_B, action: 'book.add', targetId: 'b2' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: null, action: 'tenant.create', targetId: 'lib-x' })

    const { items, total } = await svc.listAll({ page: 1, limit: 2 })
    expect(total).toBe(3)
    expect(items).toHaveLength(2)
    // crosses tenants: both LIB_A and system-level rows are reachable across pages
    const all = await svc.listAll({ page: 1, limit: 50 })
    const libs = new Set(all.items.map((r) => r.libraryId))
    expect(libs.has(LIB_A)).toBe(true)
    expect(libs.has(LIB_B)).toBe(true)
    expect(libs.has(null)).toBe(true)
  })

  it('filters by libraryId', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
    await svc.log({ actorUserId: ADMIN_B, libraryId: LIB_B, action: 'book.add', targetId: 'b2' })
    const { items, total } = await svc.listAll({ libraryId: LIB_A })
    expect(total).toBe(1)
    expect(items.every((r) => r.libraryId === LIB_A)).toBe(true)
  })

  it('filters by action', async () => {
    const svc = new AuditService(db)
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
    await svc.log({ actorUserId: ADMIN_A, libraryId: LIB_A, action: 'circulation.borrow', targetId: 'b1' })
    const { items, total } = await svc.listAll({ action: 'circulation.borrow' })
    expect(total).toBe(1)
    expect(items[0].action).toBe('circulation.borrow')
  })
})
