import { beforeEach, describe, expect, it } from 'vitest'

import { createTestServer } from './testHarness'
import { createTestDb, seedLibrary, seedUser, type Database } from '@obc/db/testing'
import { membership, user } from '@obc/db'
import { eq } from 'drizzle-orm'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, 'lib-a')
  await seedUser(db, 'u1', 'lib-a', 'library_reader') // user row exists; no membership yet
})

function req(path: string, init?: RequestInit) {
  return new Request(`https://openbookcorner.jizu.dev${path}`, init)
}

async function addMembership(userId: string, libraryId: string, role: 'library_admin' | 'library_reader') {
  await db.insert(membership).values({
    id: `m-${userId}-${libraryId}`,
    userId,
    libraryId,
    role,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

describe('GET /api/membership/mine', () => {
  it('401 when unauthenticated', async () => {
    const app = createTestServer({ db, session: null })
    expect((await app.request(req('/api/membership/mine'))).status).toBe(401)
  })

  it('returns the authenticated user’s active libraries', async () => {
    await addMembership('u1', 'lib-a', 'library_reader')
    await db.update(user).set({ activeLibraryId: 'lib-a' }).where(eq(user.id, 'u1'))
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(req('/api/membership/mine'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ libraryId: string; active: boolean }>
    expect(body).toHaveLength(1)
    expect(body[0]!.libraryId).toBe('lib-a')
    expect(body[0]!.active).toBe(true)
  })

  it('returns an empty list for a brand-new user with no memberships', async () => {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    expect(await (await app.request(req('/api/membership/mine'))).json()).toEqual([])
  })
})

describe('POST /api/membership/create-library', () => {
  it('creates a library + admin membership + sets it active', async () => {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(
      req('/api/membership/create-library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'New Lib', emailDomains: [] }),
      }),
    )
    expect(res.status).toBe(200)
    const { id } = (await res.json()) as { id: string }
    const m = await db.select().from(membership).where(eq(membership.libraryId, id)).get!()
    expect(m?.userId).toBe('u1')
    expect(m?.role).toBe('library_admin')
    const u = await db.select().from(user).where(eq(user.id, 'u1')).get!()
    expect(u?.activeLibraryId).toBe(id)
  })
})

describe('POST /api/membership/switch', () => {
  it('switches to a library the user belongs to', async () => {
    await seedLibrary(db, 'lib-b')
    await addMembership('u1', 'lib-a', 'library_reader')
    await addMembership('u1', 'lib-b', 'library_reader')
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(
      req('/api/membership/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ libraryId: 'lib-b' }),
      }),
    )
    expect(res.status).toBe(200)
    const u = await db.select().from(user).where(eq(user.id, 'u1')).get!()
    expect(u?.activeLibraryId).toBe('lib-b')
  })

  it('403 NOT_A_MEMBER when switching to a library the user does not belong to', async () => {
    await seedLibrary(db, 'lib-b')
    await addMembership('u1', 'lib-a', 'library_reader')
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(
      req('/api/membership/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ libraryId: 'lib-b' }),
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'NOT_A_MEMBER' })
  })
})
