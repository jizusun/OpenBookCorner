import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser, type Database } from '@obc/db/testing'
import { libraries } from '@obc/db'
import { eq } from 'drizzle-orm'
import { JoinRequestService } from './join-request'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
  // public lib
  await seedLibrary(db, 'lib-pub')
  await db.update(libraries).set({ visibility: 'public' }).where(eq(libraries.id, 'lib-pub'))
  // private lib
  await seedLibrary(db, 'lib-priv')
  await seedUser(db, 'u1', 'lib-pub')
  await seedUser(db, 'admin1', 'lib-pub', 'library_admin')
})

describe('JoinRequestService.discoverPublic', () => {
  it('returns public libraries the user has no membership in', async () => {
    const svc = new JoinRequestService(db)
    await seedUser(db, 'fresh', 'lib-pub') // no memberships
    const list = await svc.discoverPublic('fresh')
    expect(list.map((l) => l.id)).toContain('lib-pub')
    expect(list.map((l) => l.id)).not.toContain('lib-priv')
  })

  it('excludes libraries the user already belongs to', async () => {
    const svc = new JoinRequestService(db)
    const { MembershipService } = await import('./membership')
    await new MembershipService(db).upsertActive('u1', 'lib-pub', 'library_reader')
    const list = await svc.discoverPublic('u1')
    expect(list.map((l) => l.id)).not.toContain('lib-pub')
  })
})

describe('JoinRequestService.submit', () => {
  it('creates a pending request', async () => {
    const svc = new JoinRequestService(db)
    const res = await svc.submit('u1', 'lib-pub', 'button')
    expect(res).toHaveProperty('id')
    const pending = await svc.listPending('lib-pub')
    expect(pending.map((r) => r.userId)).toContain('u1')
  })

  it('blocks duplicate requests', async () => {
    const svc = new JoinRequestService(db)
    await svc.submit('u1', 'lib-pub', 'button')
    const res = await svc.submit('u1', 'lib-pub', 'button')
    expect(res).toEqual({ error: 'REQUEST_PENDING' })
  })

  it('blocks requests from existing members', async () => {
    const { MembershipService } = await import('./membership')
    await new MembershipService(db).upsertActive('u1', 'lib-pub', 'library_reader')
    const res = await new JoinRequestService(db).submit('u1', 'lib-pub', 'button')
    expect(res).toEqual({ error: 'ALREADY_MEMBER' })
  })
})

describe('JoinRequestService.approve', () => {
  it('creates an active membership and marks the request approved', async () => {
    const svc = new JoinRequestService(db)
    const { id } = (await svc.submit('u1', 'lib-pub', 'button')) as { id: string }
    const result = await svc.approve(id, 'admin1', 'lib-pub')
    expect(result).toEqual({ success: true })

    const { MembershipService } = await import('./membership')
    const m = await new MembershipService(db).activeMembership('u1', 'lib-pub')
    expect(m?.role).toBe('library_reader')
  })

  it('returns NOT_FOUND for unknown request id', async () => {
    expect(await new JoinRequestService(db).approve('nope', 'admin1', 'lib-pub')).toEqual({
      error: 'REQUEST_NOT_FOUND',
    })
  })
})

describe('JoinRequestService.reject + cancel', () => {
  it('reject marks the request rejected', async () => {
    const svc = new JoinRequestService(db)
    const { id } = (await svc.submit('u1', 'lib-pub', 'button')) as { id: string }
    await svc.reject(id, 'admin1', 'lib-pub')
    expect(await svc.listPending('lib-pub')).toHaveLength(0)
  })

  it('cancel removes own request from pending list', async () => {
    const svc = new JoinRequestService(db)
    const { id } = (await svc.submit('u1', 'lib-pub', 'button')) as { id: string }
    await svc.cancel(id, 'u1')
    expect(await svc.listPending('lib-pub')).toHaveLength(0)
  })
})
