/**
 * Integration tests for per-tenant subdomain enforcement (ADR 0003 §3/§5),
 * exercised against the real composed hc app via the harness.
 *
 * Rules enforced by `tenantHostGuard` on tenant-scoped API routes:
 *  - apex / reserved host  → NO tenant constraint (pass through to normal guards)
 *  - super_admin on a tenant host → 409 REDIRECT_TO_APEX (members-only hosts)
 *  - non-super user whose libraryId !== the host's tenant → 403 WRONG_TENANT
 *  - matching user on their own tenant host → allowed
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createTestServer } from './testHarness'
import { createTestDb, seedBook, seedUser } from '@obc/db/testing'
import { libraries, type Database } from '@obc/db'

let db: Database

async function seedLibraryWithSlug(db: Database, id: string, slug: string) {
  await db.insert(libraries).values({
    id,
    name: `Library ${id}`,
    emailDomains: ['@test.com'],
    settings: { borrowingPeriodDays: 14, maxBooksPerReader: 5, allowExtensions: false },
    isActive: true,
    slug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

beforeEach(async () => {
  db = await createTestDb()
  await seedLibraryWithSlug(db, 'lib-acme', 'acme')
  await seedLibraryWithSlug(db, 'lib-beta', 'beta')
  await seedUser(db, 'acme-reader', 'lib-acme', 'library_reader')
  await seedUser(db, 'beta-reader', 'lib-beta', 'library_reader')
  await seedUser(db, 'super', 'lib-acme', 'super_admin')
  await seedBook(db, 'bk1', 'lib-acme')
})

/** Request against a given Host (controls tenant resolution). */
function reqOn(host: string, path: string, init?: RequestInit) {
  return new Request(`https://${host}${path}`, init)
}

describe('tenant subdomain enforcement', () => {
  it('allows a matching user on their own tenant host', async () => {
    const app = createTestServer({
      db,
      session: { id: 'acme-reader', libraryId: 'lib-acme', role: 'library_reader' },
    })
    const res = await app.request(reqOn('acme.openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(200)
  })

  it('rejects a foreign-tenant user on another tenant host (403 WRONG_TENANT)', async () => {
    const app = createTestServer({
      db,
      session: { id: 'beta-reader', libraryId: 'lib-beta', role: 'library_reader' },
    })
    const res = await app.request(reqOn('acme.openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'WRONG_TENANT' })
  })

  it('signals redirect-to-apex for a super_admin on a tenant host (409 REDIRECT_TO_APEX)', async () => {
    const app = createTestServer({
      db,
      session: { id: 'super', libraryId: 'lib-acme', role: 'super_admin' },
    })
    const res = await app.request(reqOn('acme.openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'REDIRECT_TO_APEX' })
  })

  it('applies NO tenant constraint on the apex host (normal guards only)', async () => {
    const app = createTestServer({
      db,
      // A super admin would normally be redirected on a tenant host; on the apex
      // there is no constraint, so the usual guards decide (reader allowed here).
      session: { id: 'acme-reader', libraryId: 'lib-acme', role: 'library_reader' },
    })
    const res = await app.request(reqOn('openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(200)
  })

  it('applies NO tenant constraint on a reserved host (preview)', async () => {
    const app = createTestServer({
      db,
      session: { id: 'beta-reader', libraryId: 'lib-beta', role: 'library_reader' },
    })
    // On preview.* the foreign-tenant rule does NOT apply.
    const res = await app.request(reqOn('preview.openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(200)
  })

  it('super_admin is unconstrained on the apex host', async () => {
    const app = createTestServer({
      db,
      session: { id: 'super', libraryId: 'lib-acme', role: 'super_admin' },
    })
    const res = await app.request(reqOn('openbookcorner.jizu.dev', '/api/tenant'))
    expect(res.status).toBe(200)
  })

  it('rejects an unknown tenant host for a non-super user (no such library → WRONG_TENANT)', async () => {
    const app = createTestServer({
      db,
      session: { id: 'acme-reader', libraryId: 'lib-acme', role: 'library_reader' },
    })
    const res = await app.request(reqOn('ghost.openbookcorner.jizu.dev', '/api/book'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'WRONG_TENANT' })
  })
})
