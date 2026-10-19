import { describe, it, expect } from 'vitest'

import { auditActionKind, formatAuditRow, type AuditRow } from './audit-format'

const base: AuditRow = {
  id: 'a1',
  actorUserId: 'super-1',
  onBehalfOfUserId: null,
  libraryId: null,
  action: 'tenant.create',
  targetType: 'library',
  targetId: 'lib-9',
  metadata: null,
  createdAt: '2026-10-19T06:03:00.000Z',
}

describe('auditActionKind', () => {
  it('classifies known actions', () => {
    expect(auditActionKind('impersonation.start')).toBe('impersonation.start')
    expect(auditActionKind('impersonation.stop')).toBe('impersonation.stop')
    expect(auditActionKind('tenant.create')).toBe('tenant.create')
    expect(auditActionKind('tenant.setActive')).toBe('tenant.setActive')
    expect(auditActionKind('tenant.update')).toBe('tenant.update')
    expect(auditActionKind('tenant.delete')).toBe('tenant.delete')
  })

  it('returns "unknown" for unmapped actions', () => {
    expect(auditActionKind('something.weird')).toBe('unknown')
  })
})

describe('formatAuditRow', () => {
  it('produces a display model with kind, actor, target and a formatted time', () => {
    const vm = formatAuditRow(base)
    expect(vm.id).toBe('a1')
    expect(vm.kind).toBe('tenant.create')
    expect(vm.action).toBe('tenant.create')
    expect(vm.actorUserId).toBe('super-1')
    expect(vm.targetId).toBe('lib-9')
    expect(vm.time).toMatch(/2026/)
    expect(vm.time).not.toBe(base.createdAt)
  })

  it('flags impersonation ("on behalf of") when onBehalfOfUserId is set', () => {
    const vm = formatAuditRow({ ...base, action: 'impersonation.start', onBehalfOfUserId: 'reader-7' })
    expect(vm.kind).toBe('impersonation.start')
    expect(vm.onBehalfOf).toBe('reader-7')
    expect(vm.isImpersonation).toBe(true)
  })

  it('does not flag impersonation for a normal action', () => {
    const vm = formatAuditRow(base)
    expect(vm.onBehalfOf).toBeNull()
    expect(vm.isImpersonation).toBe(false)
  })

  it('uses a placeholder when target is missing', () => {
    expect(formatAuditRow({ ...base, targetType: null, targetId: null }).targetDisplay).toBe('—')
  })

  it('shows the target id when present', () => {
    expect(formatAuditRow(base).targetDisplay).toBe('lib-9')
  })

  it('handles null vs present metadata without throwing', () => {
    expect(() => formatAuditRow({ ...base, metadata: null })).not.toThrow()
    expect(formatAuditRow({ ...base, metadata: { slug: 'acme' } }).hasMetadata).toBe(true)
    expect(formatAuditRow({ ...base, metadata: null }).hasMetadata).toBe(false)
  })

  it('tolerates an empty/invalid createdAt (no crash, returns a string)', () => {
    expect(typeof formatAuditRow({ ...base, createdAt: '' }).time).toBe('string')
  })
})
