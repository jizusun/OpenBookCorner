/**
 * Pure client helpers for impersonation UI (ADR 0004 Part B). Kept pure so the
 * decision/display logic is unit-tested; the actual session swap is Better
 * Auth's admin plugin (authClient.admin.impersonateUser / stopImpersonating).
 */

/** A Better Auth session carries `impersonatedBy` (the real admin) while active. */
export interface SessionLike {
  impersonatedBy?: string | null
}

export type ImpersonationState = { active: true; actorId: string } | { active: false }

/** Derive whether the current session is an impersonation + who the real admin is. */
export function impersonationState(session: SessionLike | null | undefined): ImpersonationState {
  if (session && session.impersonatedBy) return { active: true, actorId: session.impersonatedBy }
  return { active: false }
}

/**
 * Whether to show the "Impersonate" action for a target user. Super-admin only,
 * never for yourself, and needs a real target id (least privilege; mirrors the
 * server-side `canImpersonate`).
 */
export function canShowImpersonateAction(
  viewerRole: string | null | undefined,
  targetUserId: string,
  viewerId: string,
): boolean {
  if (!targetUserId) return false
  if (viewerRole !== 'super_admin') return false
  if (targetUserId === viewerId) return false
  return true
}

/**
 * Whether a super admin may impersonate a target USER whose role is known
 * (global user directory). Builds on `canShowImpersonateAction` and additionally
 * refuses to impersonate another admin/super-admin — mirroring Better Auth's
 * `allowImpersonatingAdmins: false`, so the UI never offers an action the server
 * would reject.
 */
export function canImpersonateUser(
  viewerRole: string | null | undefined,
  viewerId: string,
  target: { id: string; role: string },
): boolean {
  if (!canShowImpersonateAction(viewerRole, target.id, viewerId)) return false
  // Allow-list, NOT deny-list: only a library_reader may be impersonated.
  // Anything else — library_admin, super_admin, or an empty/unknown role
  // (legacy/dirty data) — is refused, mirroring the server guard and avoiding
  // "impersonate anyone" when a role is missing.
  return target.role === 'library_reader'
}
