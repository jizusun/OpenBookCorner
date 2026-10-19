import { describe, it, expect } from 'vitest'

import { canShowImpersonateAction, impersonationState } from './impersonation'

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
