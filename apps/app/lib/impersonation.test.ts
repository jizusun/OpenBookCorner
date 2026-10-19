import { describe, it, expect } from 'vitest'

import { canImpersonateUser, canShowImpersonateAction, impersonationState } from './impersonation'

describe('impersonationState', () => {
  it('is active when the session carries impersonatedBy', () => {
    expect(impersonationState({ impersonatedBy: 'super-1' })).toEqual({
      active: true,
      actorId: 'super-1',
    })
  })

  it('is inactive for a normal session or null', () => {
    expect(impersonationState({ impersonatedBy: null })).toEqual({ active: false })
    expect(impersonationState({})).toEqual({ active: false })
    expect(impersonationState(null)).toEqual({ active: false })
    expect(impersonationState(undefined)).toEqual({ active: false })
  })
})

describe('canShowImpersonateAction', () => {
  it('shows the action to a super admin for OTHER users', () => {
    expect(canShowImpersonateAction('super_admin', 'u-2', 'u-1')).toBe(true)
  })
  it('hides it for self, non-super roles, and missing ids', () => {
    expect(canShowImpersonateAction('super_admin', 'u-1', 'u-1')).toBe(false)
    expect(canShowImpersonateAction('library_admin', 'u-2', 'u-1')).toBe(false)
    expect(canShowImpersonateAction('library_reader', 'u-2', 'u-1')).toBe(false)
    expect(canShowImpersonateAction('super_admin', '', 'u-1')).toBe(false)
  })
})

describe('canImpersonateUser', () => {
  it('allows a super admin to impersonate a reader (not self, not admin)', () => {
    expect(canImpersonateUser('super_admin', 'root', { id: 'alice', role: 'library_reader' })).toBe(true)
  })
  it('refuses to impersonate an admin or super admin (mirrors allowImpersonatingAdmins:false)', () => {
    expect(canImpersonateUser('super_admin', 'root', { id: 'bob', role: 'library_admin' })).toBe(false)
    expect(canImpersonateUser('super_admin', 'root', { id: 'x', role: 'super_admin' })).toBe(false)
  })
  it('refuses self and non-super viewers', () => {
    expect(canImpersonateUser('super_admin', 'root', { id: 'root', role: 'library_reader' })).toBe(false)
    expect(canImpersonateUser('library_admin', 'bob', { id: 'alice', role: 'library_reader' })).toBe(false)
  })
})
