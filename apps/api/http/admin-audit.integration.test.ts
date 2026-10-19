import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { AuditService } from '../services/audit'
import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'root', LIB_A, 'super_admin')
  const a = new AuditService(db)
  await a.log({ actorUserId: 'root', libraryId: LIB_A, action: 'book.add', targetId: 'b1' })
  await a.log({ actorUserId: 'root', libraryId: LIB_B, action: 'circulation.borrow', targetId: 'b2' })
  await a.log({ actorUserId: 'root', libraryId: null, action: 'tenant.create', targetId: 'lib-x' })
})

function req(app: ReturnType<typeof createTestServer>, qs = '') {
  return app.request(new Request(`https://openbookcorner.jizu.dev/api/admin/audit${qs}`))
}

describe('GET /api/admin/audit (global audit)', () => {
  it('returns ALL tenants + system rows for a super admin', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin', libraryId: LIB_A } })
    const res = await req(app)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[]; total: number }
    expect(body.total).toBe(3)
  })

  it('filters by action', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin' } })
    const body = (await req(app, '?action=circulation.borrow').then((r) => r.json())) as {
      items: { action: string }[]
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.items[0].action).toBe('circulation.borrow')
  })

  it('filters by libraryId', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin' } })
    const body = (await req(app, `?libraryId=${LIB_B}`).then((r) => r.json())) as { total: number }
    expect(body.total).toBe(1)
  })

  it('forbids a library_admin and rejects anonymous', async () => {
    const admin = createTestServer({ db, session: { id: 'x', role: 'library_admin', libraryId: LIB_A } })
    expect((await req(admin)).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await req(anon)).status).toBe(401)
  })
})
