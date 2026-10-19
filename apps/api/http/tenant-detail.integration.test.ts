import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, seedBook } from '@obc/db/testing'
import type { Database } from '@obc/db'
import { members } from '@obc/db'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'root', LIB_A, 'super_admin')
  await seedBook(db, 'bk1', LIB_A)
  // Two members in LIB_A, one in LIB_B.
  await db.insert(members).values([
    { id: 'm-a1', libraryId: LIB_A, name: 'A-One', role: 'library_reader', isPlaceholder: false, createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'm-a2', libraryId: LIB_A, name: 'A-Two', role: 'library_reader', isPlaceholder: false, createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'm-b1', libraryId: LIB_B, name: 'B-One', role: 'library_reader', isPlaceholder: false, createdAt: '2025-01-01T00:00:00.000Z' },
  ])
})

const superSession = { id: 'root', role: 'super_admin', libraryId: LIB_A }
function url(p: string) {
  return `https://openbookcorner.jizu.dev/api/tenant${p}`
}

describe('GET /api/tenant/:id (single tenant summary)', () => {
  it('returns the tenant summary for a super admin', async () => {
    const app = createTestServer({ db, session: superSession })
    const res = await app.request(new Request(url(`/${LIB_A}`)))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; memberCount: number; bookCount: number }
    expect(body.id).toBe(LIB_A)
    expect(body.memberCount).toBe(2)
    expect(body.bookCount).toBe(1)
  })

  it('404s for an unknown tenant', async () => {
    const app = createTestServer({ db, session: superSession })
    expect((await app.request(new Request(url('/nope')))).status).toBe(404)
  })

  it('forbids a library_admin', async () => {
    const app = createTestServer({ db, session: { id: 'x', role: 'library_admin', libraryId: LIB_A } })
    expect((await app.request(new Request(url(`/${LIB_A}`)))).status).toBe(403)
  })
})

describe('GET /api/tenant/:id/members (cross-tenant members)', () => {
  it('returns members of the REQUESTED tenant (by path id), not the session tenant', async () => {
    const app = createTestServer({ db, session: superSession })
    // Super admin is attached to LIB_A but asks for LIB_B's members.
    const res = await app.request(new Request(url(`/${LIB_B}/members`)))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: Array<{ id: string; name: string }> }
    expect(body.items.map((m) => m.name)).toEqual(['B-One'])
  })

  it('forbids a library_admin', async () => {
    const app = createTestServer({ db, session: { id: 'x', role: 'library_admin', libraryId: LIB_A } })
    expect((await app.request(new Request(url(`/${LIB_A}/members`)))).status).toBe(403)
  })
})
