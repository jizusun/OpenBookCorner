import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'

import { createTestDb, seedLibrary, seedUser, type Database } from '@obc/db/testing'
import { membership, user } from '@obc/db'
import { MembershipService, validateJoinAnswers } from './membership'

describe('validateJoinAnswers (pure)', () => {
  const fields = [
    { key: 'employee_id', type: 'text' as const, required: true, verifyEmail: false },
    { key: 'dept', type: 'select' as const, required: false, verifyEmail: false },
    { key: 'company_email', type: 'email' as const, required: true, verifyEmail: true },
  ]

  it('flags missing required fields', () => {
    const errs = validateJoinAnswers(fields, {})
    expect(errs).toEqual([
      { key: 'employee_id', reason: 'required' },
      { key: 'company_email', reason: 'required' },
    ])
  })

  it('ignores missing optional fields', () => {
    const errs = validateJoinAnswers(fields, {
      employee_id: 'E1',
      company_email: 'a@acme.com',
    }, ['a@acme.com'])
    expect(errs).toEqual([])
  })

  it('rejects a malformed email', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1', company_email: 'not-an-email' })
    expect(errs).toContainEqual({ key: 'company_email', reason: 'invalid_email' })
  })

  it('requires ownership verification for verifyEmail fields', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1', company_email: 'a@acme.com' }, [])
    expect(errs).toContainEqual({ key: 'company_email', reason: 'email_not_verified' })
  })

  it('passes when the verified email matches (case-insensitive)', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1', company_email: 'A@Acme.com' }, ['a@acme.com'])
    expect(errs).toEqual([])
  })

  it('treats whitespace-only as empty for required', () => {
    const errs = validateJoinAnswers(fields, { employee_id: '   ', company_email: 'a@acme.com' }, ['a@acme.com'])
    expect(errs).toContainEqual({ key: 'employee_id', reason: 'required' })
  })
})

describe('MembershipService', () => {
  let db: Database
  beforeEach(async () => {
    db = await createTestDb()
    await seedLibrary(db, 'lib-a')
    await seedLibrary(db, 'lib-b')
    await seedUser(db, 'u1', 'lib-a', 'library_reader')
  })

  it('upsertActive creates then updates an active membership (idempotent per user+library)', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_reader')
    await svc.upsertActive('u1', 'lib-a', 'library_admin') // same pair → update, not duplicate
    const list = await svc.listForUser('u1')
    expect(list).toHaveLength(1)
    expect(list[0]!.role).toBe('library_admin')
    expect(list[0]!.status).toBe('active')
  })

  it('a user can hold memberships in multiple libraries', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_admin')
    await svc.upsertActive('u1', 'lib-b', 'library_reader')
    const list = await svc.listForUser('u1')
    expect(list.map((m) => m.libraryId).sort()).toEqual(['lib-a', 'lib-b'])
  })

  it('activeMembership returns the active row and null for a non-member', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_admin')
    expect((await svc.activeMembership('u1', 'lib-a'))?.role).toBe('library_admin')
    expect(await svc.activeMembership('u1', 'lib-b')).toBeNull()
  })

  it('listUserLibraries returns active memberships with names + active flag', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_admin')
    await svc.upsertActive('u1', 'lib-b', 'library_reader')
    await db.update(user).set({ activeLibraryId: 'lib-b' }).where(eq(user.id, 'u1'))
    const libs = await svc.listUserLibraries('u1')
    expect(libs).toHaveLength(2)
    const b = libs.find((l) => l.libraryId === 'lib-b')!
    expect(b.active).toBe(true)
    expect(b.role).toBe('library_reader')
    expect(libs.find((l) => l.libraryId === 'lib-a')!.active).toBe(false)
  })

  it('listUserLibraries excludes suspended/removed memberships', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_reader')
    await db.update(membership).set({ status: 'suspended' }).where(eq(membership.libraryId, 'lib-a'))
    expect(await svc.listUserLibraries('u1')).toHaveLength(0)
  })

  it('switchActive only succeeds for a library the user actively belongs to', async () => {
    const svc = new MembershipService(db)
    await svc.upsertActive('u1', 'lib-a', 'library_reader')
    expect(await svc.switchActive('u1', 'lib-a')).toBe(true)
    expect(await svc.switchActive('u1', 'lib-b')).toBe(false) // not a member
  })

  it('createLibraryAsAdmin creates the library, an admin membership, and sets it active', async () => {
    const svc = new MembershipService(db)
    const res = await svc.createLibraryAsAdmin('u1', { name: 'Acme Books', emailDomains: ['@acme.com'] })
    expect(res.id).toBeTruthy()
    const libs = await svc.listUserLibraries('u1')
    const created = libs.find((l) => l.libraryId === res.id)!
    expect(created.role).toBe('library_admin')
    expect(created.active).toBe(true)
  })
})
