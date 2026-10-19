import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, seedBook } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { AuditService } from './audit'
import { OverviewService } from './overview'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'alice', LIB_A, 'library_reader')
  await seedUser(db, 'bob', LIB_A, 'library_admin')
  await seedUser(db, 'carol', LIB_B, 'library_reader')
  await seedBook(db, 'bk1', LIB_A)
  await seedBook(db, 'bk2', LIB_B)
  await new AuditService(db).log({ actorUserId: 'bob', libraryId: null, action: 'tenant.create', targetId: LIB_B })
})

describe('OverviewService.get', () => {
  it('aggregates system-wide counts', async () => {
    const o = await new OverviewService(db).get()
    expect(o.counts.tenants).toBe(2)
    expect(o.counts.users).toBe(3)
    expect(o.counts.books).toBe(2)
  })

  it('includes recent system audit entries (newest first, capped)', async () => {
    const o = await new OverviewService(db).get()
    expect(o.recentAudit.length).toBeGreaterThanOrEqual(1)
    expect(o.recentAudit[0].action).toBe('tenant.create')
  })

  it('includes a per-tenant snapshot with counts', async () => {
    const o = await new OverviewService(db).get()
    expect(o.tenants).toHaveLength(2)
    const a = o.tenants.find((tn) => tn.id === LIB_A)!
    expect(a.bookCount).toBe(1)
    // listAll's memberCount counts user rows: LIB_A has 2 users.
    expect(a.memberCount).toBe(2)
  })
})
