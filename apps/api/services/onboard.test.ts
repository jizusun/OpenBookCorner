import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database } from '@obc/db'
import { user as userTable, members } from '@obc/db'
import { eq } from 'drizzle-orm'

import { createTenantUser } from './onboard'

const LIB_A = 'lib-a'

let db: Database
// Fake "create Better Auth account": assigns a deterministic id; records calls.
let created: Array<{ email: string; name: string; password: string }>
const makeAccount = vi.fn(async (input: { email: string; name: string; password: string }) => {
  created.push(input)
  const id = `user-${input.email}`
  await db.insert(userTable).values({
    id,
    email: input.email,
    name: input.name,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return { userId: id }
})

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedUser(db, 'existing', LIB_A, 'library_reader') // existing@test.com
  created = []
  makeAccount.mockClear()
})

describe('createTenantUser', () => {
  const base = {
    libraryId: LIB_A,
    email: 'New.Admin@Acme.com',
    name: 'New Admin',
    password: 'password123',
    role: 'library_admin' as const,
    actorUserId: 'super-1',
  }

  it('creates the account, sets libraryId + role, and links a member record', async () => {
    const res = await createTenantUser(db, makeAccount, base)
    expect(res.error).toBeUndefined()
    const u = await db.select().from(userTable).where(eq(userTable.id, res.userId!)).get()
    expect(u?.email).toBe('new.admin@acme.com') // normalized
    expect(u?.libraryId).toBe(LIB_A)
    expect(u?.role).toBe('library_admin')
    const m = await db.select().from(members).where(eq(members.userId, res.userId!)).get()
    expect(m?.libraryId).toBe(LIB_A)
    expect(m?.role).toBe('library_admin')
    expect(m?.name).toBe('New Admin')
  })

  it('normalizes the email (lowercase/trim) before creating', async () => {
    await createTenantUser(db, makeAccount, { ...base, email: '  Foo@Bar.COM ' })
    expect(created[0].email).toBe('foo@bar.com')
  })

  it('fixes the role to the requested one (reader) regardless', async () => {
    const res = await createTenantUser(db, makeAccount, { ...base, email: 'r@acme.com', role: 'library_reader' })
    const u = await db.select().from(userTable).where(eq(userTable.id, res.userId!)).get()
    expect(u?.role).toBe('library_reader')
  })

  it('returns EMAIL_TAKEN when the email already exists (no account created)', async () => {
    const res = await createTenantUser(db, makeAccount, { ...base, email: 'existing@test.com' })
    expect(res.error).toBe('EMAIL_TAKEN')
    expect(makeAccount).not.toHaveBeenCalled()
  })

  it('returns LIBRARY_NOT_FOUND for an unknown tenant', async () => {
    const res = await createTenantUser(db, makeAccount, { ...base, libraryId: 'nope' })
    expect(res.error).toBe('LIBRARY_NOT_FOUND')
    expect(makeAccount).not.toHaveBeenCalled()
  })

  it('writes an audit row with the real actor, tenant scope, and new user as target', async () => {
    const res = await createTenantUser(db, makeAccount, base)
    const { AuditService } = await import('./audit')
    const rows = await new AuditService(db).listByLibrary(LIB_A)
    const row = rows.find((r) => r.targetId === res.userId)
    expect(row).toBeTruthy()
    expect(row!.actorUserId).toBe('super-1')
    expect(row!.libraryId).toBe(LIB_A)
  })
})
