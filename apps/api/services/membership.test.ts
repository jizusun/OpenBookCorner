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

  // Phase 2 (OTP not yet implemented): verifyEmail is a display hint only.
  // A valid email value satisfies the field; ownership verification comes later.
  it('accepts a valid email in a verifyEmail field when OTP not yet enforced', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1', company_email: 'user@acme.com' }, [])
    // Should NOT include email_not_verified — just pass through
    expect(errs.map((e) => e.reason)).not.toContain('email_not_verified')
    expect(errs).toEqual([])
  })

  it('still rejects a malformed email even on a verifyEmail field', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1', company_email: 'not-valid' })
    expect(errs).toContainEqual({ key: 'company_email', reason: 'invalid_email' })
  })

  it('still requires the verifyEmail field to be present (required check)', () => {
    const errs = validateJoinAnswers(fields, { employee_id: 'E1' })
    expect(errs).toContainEqual({ key: 'company_email', reason: 'required' })
  })

  it('treats whitespace-only as empty for required', () => {
    const errs = validateJoinAnswers(fields, { employee_id: '   ', company_email: 'a@acme.com' }, ['a@acme.com'])
    expect(errs).toContainEqual({ key: 'employee_id', reason: 'required' })
  })

  describe('allowedDomains', () => {
    const emailField = [
      { key: 'work_email', type: 'email' as const, required: true, verifyEmail: false,
        allowedDomains: ['@acme.com', '@acme.org'] },
    ]

    it('accepts an email matching one of the allowed domains', () => {
      const errs = validateJoinAnswers(emailField, { work_email: 'alice@acme.com' })
      expect(errs).toEqual([])
    })

    it('accepts an email matching domain case-insensitively', () => {
      const errs = validateJoinAnswers(emailField, { work_email: 'Alice@ACME.COM' })
      expect(errs).toEqual([])
    })

    it('rejects an email whose domain is not in the allowed list', () => {
      const errs = validateJoinAnswers(emailField, { work_email: 'alice@gmail.com' })
      expect(errs).toContainEqual({ key: 'work_email', reason: 'domain_not_allowed' })
    })

    it('rejects a subdomain that is not explicitly listed', () => {
      const errs = validateJoinAnswers(emailField, { work_email: 'alice@mail.acme.com' })
      expect(errs).toContainEqual({ key: 'work_email', reason: 'domain_not_allowed' })
    })

    it('skips domain check when allowedDomains is empty', () => {
      const noRestriction = [
        { key: 'email', type: 'email' as const, required: true, verifyEmail: false, allowedDomains: [] },
      ]
      const errs = validateJoinAnswers(noRestriction, { email: 'anyone@anywhere.io' })
      expect(errs).toEqual([])
    })

    it('skips domain check when allowedDomains is undefined', () => {
      const noRestriction = [
        { key: 'email', type: 'email' as const, required: true, verifyEmail: false },
      ]
      const errs = validateJoinAnswers(noRestriction, { email: 'anyone@anywhere.io' })
      expect(errs).toEqual([])
    })
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
