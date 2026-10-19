import type { Database } from '@obc/db'

import { AuditService } from '../services/audit'
import { impersonationAuditEntry } from './impersonation'

/**
 * Session info needed to decide whether an impersonation audit row is warranted.
 * `impersonatedBy` is the REAL super-admin id (null for normal sessions); the
 * target is the impersonated user.
 */
export interface ImpersonationSessionInfo {
  impersonatedBy: string | null | undefined
  targetUserId: string
  targetLibraryId: string | null
}

/**
 * Called from Better Auth's `databaseHooks.session.create.after`. Writes an
 * `impersonation.start` audit row ONLY when the newly created session is an
 * impersonation (has `impersonatedBy`). No-op for normal logins. The REAL actor
 * (super admin) is preserved as `actorUserId`; the impersonated user is
 * `onBehalfOfUserId`, scoped to the target's tenant so that tenant can see it.
 */
export async function auditImpersonationStart(
  db: Database,
  info: ImpersonationSessionInfo,
): Promise<void> {
  if (!info.impersonatedBy) return
  await new AuditService(db).log(
    impersonationAuditEntry(
      info.impersonatedBy,
      { id: info.targetUserId, libraryId: info.targetLibraryId },
      'start',
    ),
  )
}

/**
 * Called when an impersonation session ends (stop-impersonating / expiry). Writes
 * an `impersonation.stop` row only if the ended session was an impersonation —
 * normal logouts are ignored.
 */
export async function auditImpersonationStop(
  db: Database,
  info: ImpersonationSessionInfo,
): Promise<void> {
  if (!info.impersonatedBy) return
  await new AuditService(db).log(
    impersonationAuditEntry(
      info.impersonatedBy,
      { id: info.targetUserId, libraryId: info.targetLibraryId },
      'stop',
    ),
  )
}
