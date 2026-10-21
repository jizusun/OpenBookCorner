import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, type Database } from '@obc/db/testing'
import { libraries } from '@obc/db'
import { eq } from 'drizzle-orm'
import { InviteService } from './invite'
import { MembershipService } from './membership'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, 'lib-a')
  await db.update(libraries).set({ visibility: 'public', isActive: true }).where(eq(libraries.id, 'lib-a'))
  await seedUser(db, 'admin1', 'lib-a', 'library_admin')
  await seedUser(db, 'u1', 'lib-a', 'library_reader')
})

describe('InviteService', () => {
  it('creates an invite and resolves it by token', async () => {
    const svc = new InviteService(db)
    const { token } = await svc.create('lib-a', 'admin1')
    const res = await svc.resolve(token)
    expect(res?.valid).toBe(true)
    expect(res?.libraryId).toBe('lib-a')
  })

  it('returns null for an unknown token', async () => {
    expect(await new InviteService(db).resolve('badtoken')).toBeNull()
  })

  it('returns null after revocation', async () => {
    const svc = new InviteService(db)
    const { token } = await svc.create('lib-a', 'admin1')
    const list = await svc.list('lib-a')
    await svc.revoke(list[0]!.id, 'lib-a')
    expect(await svc.resolve(token)).toBeNull()
  })

  it('returns null after max uses', async () => {
    const svc = new InviteService(db)
    const { token } = await svc.create('lib-a', 'admin1', { maxUses: 1 })
    // Use it once
    await svc.use(token, 'u1')
    // Resolve again should be null (used ≥ maxUses)
    expect(await svc.resolve(token)).toBeNull()
  })

  it('auto-join (requiresApproval=false) creates an active membership', async () => {
    const svc = new InviteService(db)
    const { token } = await svc.create('lib-a', 'admin1', { requiresApproval: false })
    await svc.use(token, 'u1')
    const m = await new MembershipService(db).activeMembership('u1', 'lib-a')
    expect(m?.status).toBe('active')
  })

  it('requiresApproval=true creates a join_request (pending)', async () => {
    const svc = new InviteService(db)
    const { token } = await svc.create('lib-a', 'admin1', { requiresApproval: true })
    const res = await svc.use(token, 'u1')
    expect(res.requestId).toBeTruthy()
    expect(await new MembershipService(db).activeMembership('u1', 'lib-a')).toBeNull()
  })
})
