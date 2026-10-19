import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'alice', LIB_A, 'library_reader')
  await seedUser(db, 'carol', LIB_B, 'library_reader')
  await seedUser(db, 'root', LIB_A, 'super_admin')
})

function req(app: ReturnType<typeof createTestServer>, qs = '') {
  return app.request(new Request(`https://openbookcorner.jizu.dev/api/admin/users${qs}`))
}

describe('GET /api/admin/users (global user directory)', () => {
  it('returns users across ALL tenants for a super admin', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin', libraryId: LIB_A } })
    const res = await req(app)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ id: string; libraryId: string | null }>; total: number }
    expect(body.total).toBe(3)
    // includes users from BOTH tenants (cross-tenant), unlike tenant-scoped endpoints
    const libs = new Set(body.items.map((u) => u.libraryId))
    expect(libs.has(LIB_A)).toBe(true)
    expect(libs.has(LIB_B)).toBe(true)
  })

  it('supports search', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin' } })
    const res = await req(app, '?search=carol')
    const body = (await res.json()) as { items: Array<{ id: string }> }
    expect(body.items.map((u) => u.id)).toEqual(['carol'])
  })

  it('forbids a library_admin (super-admin only)', async () => {
    const app = createTestServer({ db, session: { id: 'a', role: 'library_admin', libraryId: LIB_A } })
    expect((await req(app)).status).toBe(403)
  })

  it('rejects an anonymous request', async () => {
    const app = createTestServer({ db, session: null })
    expect((await req(app)).status).toBe(401)
  })
})
