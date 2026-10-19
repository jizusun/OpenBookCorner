import type { AuditEntry } from '../services/audit'

/** Impersonation sessions are time-boxed (Pigment best practice: short-lived). */
export const IMPERSONATION_DURATION_SECONDS = 30 * 60

interface Actor {
  id: string
  role: string
}

/**
 * Whether `actor` may impersonate the user `targetUserId`. Super-admin only
 * (least privilege), never self, and only with a real actor + target. The slug/
 * tenant is irrelevant — a super admin is system-level and may impersonate any
 * other user. This is the authorization decision; the Better Auth admin plugin
 * performs the actual session swap.
 */
export function canImpersonate(actor: Actor | null | undefined, targetUserId: string): boolean {
  if (!actor || !targetUserId) return false
  if (actor.role !== 'super_admin') return false
  if (actor.id === targetUserId) return false
  return true
}

/**
 * Build the append-only audit entry for an impersonation start/stop. The REAL
 * actor (super admin) is always `actorUserId`; the impersonated user is
 * `onBehalfOfUserId`. Scoped to the target's tenant so that tenant can see it
 * was impersonated (Pigment: the impersonated user's org sees these logs).
 */
export function impersonationAuditEntry(
  actorUserId: string,
  target: { id: string; libraryId: string | null },
  action: 'start' | 'stop',
): AuditEntry {
  return {
    actorUserId,
    onBehalfOfUserId: target.id,
    libraryId: target.libraryId,
    action: action === 'start' ? 'impersonation.start' : 'impersonation.stop',
    targetType: 'user',
    targetId: target.id,
  }
}
