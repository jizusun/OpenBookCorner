import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedLibrary, seedUser, type Database } from '@obc/db/testing'
import { libraries, membership } from '@obc/db'
import { createTestServer } from './testHarness'
import { MembershipService } from '../services/membership'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, 'lib-a')
  await db.update(libraries).set({ visibility: 'public' }).where(eq(libraries.id, 'lib-a'))
  await seedUser(db, 'admin1', 'lib-a', 'library_admin')
  await new MembershipService(db).upsertActive('admin1', 'lib-a', 'library_admin')
  await seedUser(db, 'u1', 'lib-a', 'library_reader')
})

function req(path: string, init?: RequestInit) {
  return new Request(`https://openbookcorner.jizu.dev${path}`, init)
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('GET /api/join/discover', () => {
  it('returns public libraries the user is not already a member of', async () => {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(req('/api/join/discover'))
    expect(res.status).toBe(200)
    const libs = (await res.json()) as Array<{ id: string }>
    expect(libs.map((l) => l.id)).toContain('lib-a')
  })

  it('excludes libraries the user is already a member of', async () => {
    await new MembershipService(db).upsertActive('u1', 'lib-a', 'library_reader')
    const app = createTestServer({ db, session: { id: 'u1', activeLibraryId: 'lib-a', libraryId: 'lib-a', role: 'library_reader' } })
    const libs = (await (await app.request(req('/api/join/discover'))).json()) as Array<{ id: string }>
    expect(libs.map((l) => l.id)).not.toContain('lib-a')
  })
})

describe('POST /api/join/request', () => {
  it('creates a pending join request', async () => {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(req('/api/join/request', json({ libraryId: 'lib-a' })))
    expect(res.status).toBe(200)
    const { id } = (await res.json()) as { id: string }
    expect(id).toBeTruthy()
  })

  it('409 when a request is already pending', async () => {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    await app.request(req('/api/join/request', json({ libraryId: 'lib-a' })))
    const res = await app.request(req('/api/join/request', json({ libraryId: 'lib-a' })))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'REQUEST_PENDING' })
  })
})

describe('POST /api/join/admin/approve + reject', () => {
  async function submitRequest() {
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(req('/api/join/request', json({ libraryId: 'lib-a' })))
    return ((await res.json()) as { id: string }).id
  }

  it('approve creates an active membership', async () => {
    const requestId = await submitRequest()
    const adminApp = createTestServer({ db, session: { id: 'admin1', activeLibraryId: 'lib-a', libraryId: 'lib-a', role: 'library_admin' } })
    const res = await adminApp.request(req('/api/join/admin/approve', json({ requestId })))
    expect(res.status).toBe(200)
    const m = await new MembershipService(db).activeMembership('u1', 'lib-a')
    expect(m?.role).toBe('library_reader')
    expect(m?.status).toBe('active')
  })

  it('reject closes the request without creating a membership', async () => {
    const requestId = await submitRequest()
    const adminApp = createTestServer({ db, session: { id: 'admin1', activeLibraryId: 'lib-a', libraryId: 'lib-a', role: 'library_admin' } })
    const res = await adminApp.request(req('/api/join/admin/reject', json({ requestId })))
    expect(res.status).toBe(200)
    expect(await new MembershipService(db).activeMembership('u1', 'lib-a')).toBeNull()
  })

  it('403 when a reader tries to approve', async () => {
    const requestId = await submitRequest()
    const readerApp = createTestServer({ db, session: { id: 'u1', activeLibraryId: 'lib-a', libraryId: 'lib-a', role: 'library_reader' } })
    await new MembershipService(db).upsertActive('u1', 'lib-a', 'library_reader')
    const res = await readerApp.request(req('/api/join/admin/approve', json({ requestId })))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/join/fields/:libraryId', () => {
  it('returns join form fields for a library (public, no auth gate)', async () => {
    const { JoinFieldService } = await import('../services/join-field')
    await new JoinFieldService(db).create('lib-a', { key: 'employee_no', label: '工号', type: 'text' })
    const app = createTestServer({ db, session: { id: 'u1', libraryId: null, role: 'library_reader' } })
    const res = await app.request(req('/api/join/fields/lib-a'))
    expect(res.status).toBe(200)
    const fields = (await res.json()) as Array<{ key: string }>
    expect(fields.map((f) => f.key)).toContain('employee_no')
  })
})
