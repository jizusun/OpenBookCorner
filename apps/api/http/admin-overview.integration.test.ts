import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, seedBook } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedUser(db, 'root', LIB_A, 'super_admin')
  await seedBook(db, 'bk1', LIB_A)
})

const u = 'https://openbookcorner.jizu.dev/api/admin/overview'

describe('GET /api/admin/overview', () => {
  it('returns aggregate counts for a super admin', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin', libraryId: LIB_A } })
    const res = await app.request(new Request(u))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { counts: { tenants: number; users: number; books: number } }
    expect(body.counts.tenants).toBe(1)
    expect(body.counts.users).toBe(1)
    expect(body.counts.books).toBe(1)
  })

  it('forbids a library_admin and rejects anonymous', async () => {
    const admin = createTestServer({ db, session: { id: 'a', role: 'library_admin', libraryId: LIB_A } })
    expect((await admin.request(new Request(u))).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await anon.request(new Request(u))).status).toBe(401)
  })
})
