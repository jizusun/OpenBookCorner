import { describe, it, expect } from 'vitest'

import {
  canImpersonate,
  IMPERSONATION_DURATION_SECONDS,
  impersonationAuditEntry,
} from './impersonation'

const superAdmin = { id: 'super-1', role: 'super_admin' as const }
const libAdmin = { id: 'admin-1', role: 'library_admin' as const }
const reader = { id: 'reader-1', role: 'library_reader' as const }

describe('canImpersonate', () => {
  it('lets a super admin impersonate any OTHER user', () => {
    expect(canImpersonate(superAdmin, 'reader-1')).toBe(true)
    expect(canImpersonate(superAdmin, 'admin-9')).toBe(true)
  })

  it('forbids impersonating yourself', () => {
    expect(canImpersonate(superAdmin, 'super-1')).toBe(false)
  })

  it('forbids non-super-admin actors (least privilege)', () => {
    expect(canImpersonate(libAdmin, 'reader-1')).toBe(false)
    expect(canImpersonate(reader, 'admin-1')).toBe(false)
  })

  it('forbids when actor or target is missing', () => {
    expect(canImpersonate(null, 'reader-1')).toBe(false)
    expect(canImpersonate(undefined, 'reader-1')).toBe(false)
    expect(canImpersonate(superAdmin, '')).toBe(false)
  })
})

describe('impersonationAuditEntry', () => {
  const target = { id: 'reader-1', libraryId: 'lib-a' }

  it('builds a start entry: real actor + onBehalfOf = target, scoped to the target tenant', () => {
    expect(impersonationAuditEntry('super-1', target, 'start')).toEqual({
      actorUserId: 'super-1',
      onBehalfOfUserId: 'reader-1',
      libraryId: 'lib-a',
      action: 'impersonation.start',
      targetType: 'user',
      targetId: 'reader-1',
    })
  })

  it('builds a stop entry with the same actor/onBehalfOf', () => {
    const e = impersonationAuditEntry('super-1', target, 'stop')
    expect(e.action).toBe('impersonation.stop')
    expect(e.actorUserId).toBe('super-1')
    expect(e.onBehalfOfUserId).toBe('reader-1')
  })

  it('never puts the target id in the actor field', () => {
    const e = impersonationAuditEntry('super-1', target, 'start')
    expect(e.actorUserId).not.toBe(target.id)
  })
})

describe('IMPERSONATION_DURATION_SECONDS', () => {
  it('is time-boxed to 30 minutes', () => {
    expect(IMPERSONATION_DURATION_SECONDS).toBe(30 * 60)
  })
})
