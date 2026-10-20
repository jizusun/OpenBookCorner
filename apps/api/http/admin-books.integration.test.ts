import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedBook } from '@obc/db/testing'
import type { Database } from '@obc/db'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedBook(db, 'clean', LIB_A, '9780132350884')
  await seedBook(db, 'ddd', LIB_B, '9780321125217')
})

function req(app: ReturnType<typeof createTestServer>, qs = '') {
  return app.request(new Request(`https://openbookcorner.jizu.dev/api/admin/books${qs}`))
}

describe('GET /api/admin/books (global book list)', () => {
  it('returns books across ALL tenants for a super admin', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin', libraryId: LIB_A } })
    const res = await req(app)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: { libraryId: string }[]; total: number }
    expect(body.total).toBe(2)
    const libs = new Set(body.items.map((b) => b.libraryId))
    expect(libs.has(LIB_A) && libs.has(LIB_B)).toBe(true)
  })

  it('supports search', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin' } })
    const body = (await req(app, '?search=9780132350884').then((r) => r.json())) as {
      items: { id: string }[]
    }
    expect(body.items.map((b) => b.id)).toEqual(['clean'])
  })

  it('forbids library_admin and anonymous', async () => {
    const admin = createTestServer({ db, session: { id: 'x', role: 'library_admin', libraryId: LIB_A } })
    expect((await req(admin)).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await req(anon)).status).toBe(401)
  })
})
