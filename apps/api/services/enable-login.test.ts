import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb, seedLibrary, seedUser, seedMember } from '@obc/db/testing'
import type { Database } from '@obc/db'
import { user as userTable, members } from '@obc/db'
import { eq } from 'drizzle-orm'

import { enableMemberLogin } from './onboard'

const LIB_A = 'lib-a'

let db: Database
const makeAccount = vi.fn(async (input: { email: string; name: string; password: string }) => {
  const id = `user-${input.email}`
  await db.insert(userTable).values({
    id, email: input.email, name: input.name, emailVerified: false,
    createdAt: new Date(), updatedAt: new Date(),
  })
  return { userId: id }
})

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedUser(db, 'existing', LIB_A, 'library_reader') // existing@test.com
  await seedMember(db, 'm1', LIB_A, 'Zhang San')
  makeAccount.mockClear()
})

describe('enableMemberLogin', () => {
  const base = { memberId: 'm1', libraryId: LIB_A, email: 'zhang@acme.com', password: 'password123', actorUserId: 'admin-1' }

  it('creates a reader account and links it to the existing member', async () => {
    const res = await enableMemberLogin(db, makeAccount, base)
    expect(res.error).toBeUndefined()
    const u = await db.select().from(userTable).where(eq(userTable.id, res.userId!)).get()
    expect(u?.role).toBe('library_reader')
    expect(u?.libraryId).toBe(LIB_A)
    expect(u?.name).toBe('Zhang San') // takes the member's name
    const m = await db.select().from(members).where(eq(members.id, 'm1')).get()
    expect(m?.userId).toBe(res.userId) // linked
  })

  it('returns MEMBER_NOT_FOUND for an unknown member in this library', async () => {
    expect((await enableMemberLogin(db, makeAccount, { ...base, memberId: 'nope' })).error).toBe('MEMBER_NOT_FOUND')
    expect(makeAccount).not.toHaveBeenCalled()
  })

  it('returns ALREADY_LINKED when the member already has a login account', async () => {
    await db.update(members).set({ userId: 'existing' }).where(eq(members.id, 'm1'))
    expect((await enableMemberLogin(db, makeAccount, base)).error).toBe('ALREADY_LINKED')
    expect(makeAccount).not.toHaveBeenCalled()
  })

  it('returns EMAIL_TAKEN when the email already exists', async () => {
    expect((await enableMemberLogin(db, makeAccount, { ...base, email: 'existing@test.com' })).error).toBe('EMAIL_TAKEN')
    expect(makeAccount).not.toHaveBeenCalled()
  })
})
