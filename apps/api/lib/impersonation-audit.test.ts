import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, seedUser } from '@obc/db/testing'
import type { Database as Db } from '@obc/db'

import { AuditService } from '../services/audit'
import { auditImpersonationStart, auditImpersonationStop } from './impersonation-audit'

const LIB_A = 'lib-a'
const SUPER = 'super-1'
const READER = 'reader-1'

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await seedLibrary(db, LIB_A)
  await seedUser(db, SUPER, LIB_A, 'super_admin')
  await seedUser(db, READER, LIB_A, 'library_reader')
})

describe('auditImpersonationStart', () => {
  it('writes an impersonation.start row (real actor + onBehalfOf, target tenant) when impersonatedBy is set', async () => {
    await auditImpersonationStart(db, {
      impersonatedBy: SUPER,
      targetUserId: READER,
      targetLibraryId: LIB_A,
    })
    const rows = await new AuditService(db).listByLibrary(LIB_A)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      actorUserId: SUPER,
      onBehalfOfUserId: READER,
      libraryId: LIB_A,
      action: 'impersonation.start',
      targetType: 'user',
      targetId: READER,
    })
  })

  it('does NOT log for a normal (non-impersonation) session', async () => {
    await auditImpersonationStart(db, {
      impersonatedBy: null,
      targetUserId: READER,
      targetLibraryId: LIB_A,
    })
    expect(await new AuditService(db).listByLibrary(LIB_A)).toHaveLength(0)
  })
})

describe('auditImpersonationStop', () => {
  it('writes an impersonation.stop row when a deleted session was an impersonation', async () => {
    await auditImpersonationStop(db, {
      impersonatedBy: SUPER,
      targetUserId: READER,
      targetLibraryId: LIB_A,
    })
    const rows = await new AuditService(db).listByLibraryAction(LIB_A, 'impersonation.stop')
    expect(rows).toHaveLength(1)
    expect(rows[0].actorUserId).toBe(SUPER)
    expect(rows[0].onBehalfOfUserId).toBe(READER)
  })

  it('does NOT log when a normal session is deleted (logout)', async () => {
    await auditImpersonationStop(db, {
      impersonatedBy: null,
      targetUserId: READER,
      targetLibraryId: LIB_A,
    })
    expect(await new AuditService(db).listByLibrary(LIB_A)).toHaveLength(0)
  })
})
