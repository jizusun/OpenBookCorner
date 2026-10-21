/**
 * Integration tests for the multi-tenancy guards (lib/mw.ts) exercised against
 * the REAL composed hc app via the test harness. These cover the middle of the
 * pyramid that previously only existed in E2E:
 *   sessionAuth (401) → tenant (403 NO_LIBRARY_ACCESS) → admin (403) →
 *   superAdmin (403 SUPER_ADMIN_REQUIRED).
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createTestServer } from './testHarness'
import { createTestDb, seedBook, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, 'lib-a')
  await seedUser(db, 'reader', 'lib-a', 'library_reader')
  await seedUser(db, 'admin', 'lib-a', 'library_admin')
  await seedUser(db, 'super', 'lib-a', 'super_admin')
  await seedBook(db, 'bk1', 'lib-a')
})

function req(path: string, init?: RequestInit) {
  return new Request(`https://openbookcorner.jizu.dev${path}`, init)
}

describe('sessionAuth guard', () => {
  it('returns 401 for an unauthenticated request to a tenant route', async () => {
    const app = createTestServer({ db, session: null })
    const res = await app.request(req('/api/book'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
  })

  it('allows an authenticated member through sessionAuth+tenant', async () => {
    const app = createTestServer({
      db,
      session: { id: 'reader', libraryId: 'lib-a', role: 'library_reader' },
    })
    const res = await app.request(req('/api/book'))
    expect(res.status).toBe(200)
  })
})

describe('tenant guard', () => {
  it('returns 403 NO_LIBRARY_ACCESS when the session has no libraryId', async () => {
    const app = createTestServer({
      db,
      session: { id: 'orphan', libraryId: null, role: 'library_reader' },
    })
    const res = await app.request(req('/api/book'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'NO_LIBRARY_ACCESS' })
  })
})

describe('tenant guard — active membership (ADR 0009)', () => {
  // membership() helper: insert a membership row directly.
  async function addMembership(
    userId: string,
    libraryId: string,
    role: 'library_admin' | 'library_reader',
    status: 'active' | 'suspended' | 'removed' = 'active',
  ) {
    const { membership } = await import('@obc/db')
    await db.insert(membership).values({
      id: `m-${userId}-${libraryId}`,
      userId,
      libraryId,
      role,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  it('allows a user with an ACTIVE membership in their active library', async () => {
    await seedUser(db, 'm-reader', 'lib-a', 'library_reader')
    await addMembership('m-reader', 'lib-a', 'library_reader', 'active')
    const app = createTestServer({
      db,
      session: { id: 'm-reader', activeLibraryId: 'lib-a', libraryId: null, role: 'library_reader' },
    })
    expect((await app.request(req('/api/book'))).status).toBe(200)
  })

  it('403s when the membership in the active library is suspended', async () => {
    await seedUser(db, 'm-susp', 'lib-a', 'library_reader')
    await addMembership('m-susp', 'lib-a', 'library_reader', 'suspended')
    const app = createTestServer({
      db,
      session: { id: 'm-susp', activeLibraryId: 'lib-a', libraryId: null, role: 'library_reader' },
    })
    const res = await app.request(req('/api/book'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'NO_LIBRARY_ACCESS' })
  })

  it('403s when the active library has no membership for the user (isolation)', async () => {
    await seedLibrary(db, 'lib-b')
    await seedUser(db, 'm-other', 'lib-a', 'library_reader')
    await addMembership('m-other', 'lib-a', 'library_reader', 'active')
    // active library is B, but the user is only a member of A → blocked.
    const app = createTestServer({
      db,
      session: { id: 'm-other', activeLibraryId: 'lib-b', libraryId: null, role: 'library_reader' },
    })
    expect((await app.request(req('/api/book'))).status).toBe(403)
  })

  it('derives the role from the membership: admin in B can POST a book while reader in A cannot', async () => {
    await seedLibrary(db, 'lib-b')
    await seedUser(db, 'm-multi', 'lib-a', 'library_reader')
    await addMembership('m-multi', 'lib-a', 'library_reader', 'active')
    await addMembership('m-multi', 'lib-b', 'library_admin', 'active')
    const body = JSON.stringify({ isbn: '9780000000009', title: 'X', author: 'Y' })
    const headers = { 'content-type': 'application/json' }

    // active = A (reader) → admin-only POST forbidden
    const asReader = createTestServer({
      db,
      session: { id: 'm-multi', activeLibraryId: 'lib-a', libraryId: null, role: 'library_reader' },
    })
    expect((await asReader.request(req('/api/book', { method: 'POST', headers, body }))).status).toBe(403)

    // active = B (admin) → POST allowed
    const asAdmin = createTestServer({
      db,
      session: { id: 'm-multi', activeLibraryId: 'lib-b', libraryId: null, role: 'library_reader' },
    })
    expect((await asAdmin.request(req('/api/book', { method: 'POST', headers, body }))).status).toBe(200)
  })
})

describe('admin guard', () => {
  it('returns 403 FORBIDDEN for a member hitting an admin-only route', async () => {
    const app = createTestServer({
      db,
      session: { id: 'reader', libraryId: 'lib-a', role: 'library_reader' },
    })
    // POST /api/book is admin-only.
    const res = await app.request(
      req('/api/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isbn: '9780000000002', title: 'X', author: 'Y' }),
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'FORBIDDEN' })
  })

  it('allows an admin through the admin guard', async () => {
    const app = createTestServer({
      db,
      session: { id: 'admin', libraryId: 'lib-a', role: 'library_admin' },
    })
    const res = await app.request(
      req('/api/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isbn: '9780000000002', title: 'X', author: 'Y' }),
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('superAdmin guard', () => {
  it('returns 403 SUPER_ADMIN_REQUIRED for a library_admin on a super-admin route', async () => {
    const app = createTestServer({
      db,
      session: { id: 'admin', libraryId: 'lib-a', role: 'library_admin' },
    })
    const res = await app.request(req('/api/tenant'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'SUPER_ADMIN_REQUIRED' })
  })

  it('allows a super_admin on a super-admin route', async () => {
    const app = createTestServer({
      db,
      session: { id: 'super', libraryId: 'lib-a', role: 'super_admin' },
    })
    const res = await app.request(req('/api/tenant'))
    expect(res.status).toBe(200)
  })
})
