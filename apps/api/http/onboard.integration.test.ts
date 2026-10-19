import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'
import { user as userTable } from '@obc/db'
import { eq } from 'drizzle-orm'

import { createTestServer } from './testHarness'

const LIB_A = 'lib-a'
const LIB_B = 'lib-b'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedLibrary(db, LIB_B)
  await seedUser(db, 'root', LIB_A, 'super_admin')
  await seedUser(db, 'adminA', LIB_A, 'library_admin')
})

function postAdmin(app: ReturnType<typeof createTestServer>, id: string, body: object) {
  return app.request(
    new Request(`https://openbookcorner.jizu.dev/api/tenant/${id}/admins`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}
function postMember(app: ReturnType<typeof createTestServer>, body: object) {
  return app.request(
    new Request('https://openbookcorner.jizu.dev/api/member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const adminBody = { email: 'newadmin@acme.com', name: 'New Admin', password: 'password123' }
const readerBody = { email: 'newreader@acme.com', name: 'New Reader', password: 'password123' }

describe('POST /api/tenant/:id/admins (super-admin adds a tenant admin)', () => {
  it('creates a library_admin scoped to the PATH tenant', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin', libraryId: LIB_A } })
    const res = await postAdmin(app, LIB_B, adminBody)
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const u = await db.select().from(userTable).where(eq(userTable.id, id)).get()
    expect(u?.role).toBe('library_admin')
    expect(u?.libraryId).toBe(LIB_B) // the path tenant, not the super admin's own
  })

  it('forbids a library_admin and rejects anonymous', async () => {
    const admin = createTestServer({ db, session: { id: 'adminA', role: 'library_admin', libraryId: LIB_A } })
    expect((await postAdmin(admin, LIB_A, adminBody)).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await postAdmin(anon, LIB_A, adminBody)).status).toBe(401)
  })

  it('409s on a duplicate email', async () => {
    const app = createTestServer({ db, session: { id: 'root', role: 'super_admin' } })
    await postAdmin(app, LIB_A, adminBody)
    expect((await postAdmin(app, LIB_A, adminBody)).status).toBe(409)
  })
})

describe('POST /api/member (library admin adds a reader)', () => {
  it('creates a library_reader scoped to the SESSION tenant', async () => {
    const app = createTestServer({ db, session: { id: 'adminA', role: 'library_admin', libraryId: LIB_A } })
    const res = await postMember(app, readerBody)
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const u = await db.select().from(userTable).where(eq(userTable.id, id)).get()
    expect(u?.role).toBe('library_reader')
    expect(u?.libraryId).toBe(LIB_A) // admin's own session tenant
  })

  it('forbids a reader and rejects anonymous', async () => {
    const reader = createTestServer({ db, session: { id: 'r', role: 'library_reader', libraryId: LIB_A } })
    expect((await postMember(reader, readerBody)).status).toBe(403)
    const anon = createTestServer({ db, session: null })
    expect((await postMember(anon, readerBody)).status).toBe(401)
  })
})
