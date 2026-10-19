import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { AuditService } from '../services/audit'
import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const SUPER = 'super-1'
const ADMIN = 'admin-1'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedUser(db, SUPER, LIB_A, 'super_admin')
  await seedUser(db, ADMIN, LIB_A, 'library_admin')
  const audit = new AuditService(db)
  // One system-level row (libraryId null) + one tenant-scoped row.
  await audit.log({ actorUserId: SUPER, libraryId: null, action: 'tenant.create', targetId: 'lib-9' })
  await audit.log({ actorUserId: ADMIN, libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
})

function get(app: ReturnType<typeof createTestServer>) {
  return app.request(new Request('https://openbookcorner.jizu.dev/api/tenant/audit'))
}

describe('GET /api/tenant/audit (system audit)', () => {
  it('returns ONLY system-level rows (libraryId IS NULL) for a super admin', async () => {
    const app = createTestServer({ db, session: { id: SUPER, role: 'super_admin' } })
    const res = await get(app)
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ action: string; libraryId: string | null }>
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('tenant.create')
    expect(rows[0].libraryId).toBeNull()
    // The tenant-scoped book.add row must NOT leak into the system log.
    expect(rows.some((r) => r.action === 'book.add')).toBe(false)
  })

  it('forbids a library_admin (super-admin only)', async () => {
    const app = createTestServer({ db, session: { id: ADMIN, role: 'library_admin', libraryId: LIB_A } })
    const res = await get(app)
    expect(res.status).toBe(403)
  })

  it('rejects an anonymous request', async () => {
    const app = createTestServer({ db, session: null })
    const res = await get(app)
    expect(res.status).toBe(401)
  })
})
