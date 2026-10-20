import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, seedMember } from '@obc/db/testing'
import type { Database } from '@obc/db'
import { members } from '@obc/db'
import { eq } from 'drizzle-orm'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'adminA', LIB_A, 'library_admin')
  await seedMember(db, 'm-a', LIB_A, 'Reader A')
  await seedMember(db, 'm-b', LIB_B, 'Reader B')
})

function post(app: ReturnType<typeof createTestServer>, id: string, body: object) {
  return app.request(
    new Request(`https://openbookcorner.jizu.dev/api/member/${id}/enable-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const body = { email: 'readera@acme.com', password: 'password123' }

describe('POST /api/member/:id/enable-login', () => {
  it('links a new reader account to the member (library admin, session tenant)', async () => {
    const app = createTestServer({ db, session: { id: 'adminA', role: 'library_admin', libraryId: LIB_A } })
    const res = await post(app, 'm-a', body)
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const m = await db.select().from(members).where(eq(members.id, 'm-a')).get()
    expect(m?.userId).toBe(id)
  })

  it('cannot enable login for a member in ANOTHER tenant (session-scoped)', async () => {
    const app = createTestServer({ db, session: { id: 'adminA', role: 'library_admin', libraryId: LIB_A } })
    // m-b belongs to LIB_B; the LIB_A admin must not reach it.
    expect((await post(app, 'm-b', body)).status).toBe(404)
  })

  it('forbids a reader and rejects anonymous', async () => {
    const reader = createTestServer({ db, session: { id: 'r', role: 'library_reader', libraryId: LIB_A } })
    expect((await post(reader, 'm-a', body)).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await post(anon, 'm-a', body)).status).toBe(401)
  })
})
