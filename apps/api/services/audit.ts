import { and, desc, eq, isNull } from 'drizzle-orm'

import { auditLogs, type Database } from '@obc/db'

/** Input for recording one privileged action. */
export interface AuditEntry {
  /** The REAL user who performed the action (never the impersonated user). */
  actorUserId: string
  /** Set ONLY during impersonation: the user being acted as. */
  onBehalfOfUserId?: string | null
  /** Tenant scope; null for cross-tenant/system ops (e.g. tenant.create). */
  libraryId?: string | null
  /** e.g. 'book.add', 'library.updateSettings', 'tenant.setActive'. */
  action: string
  targetType?: string | null
  targetId?: string | null
  /** Small, non-sensitive detail (ids / flags) — never secrets or PII. */
  metadata?: Record<string, unknown> | null
}

/**
 * Append-only audit log of privileged actions (ADR 0004 Part A).
 *
 * - Writes happen server-side at the guard/service layer, so a direct API call
 *   cannot skip them.
 * - Reads are tenant-scoped (a library admin sees only their tenant).
 * - Rows are never updated or deleted (no such methods here).
 */
export class AuditService {
  constructor(private db: Database) {}

  /** Record one action. Best-effort id via crypto.randomUUID(). */
  async log(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: entry.actorUserId,
      onBehalfOfUserId: entry.onBehalfOfUserId ?? null,
      libraryId: entry.libraryId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      createdAt: new Date().toISOString(),
    })
  }

  /** Tenant-scoped audit entries, newest first. */
  async listByLibrary(libraryId: string, opts: { limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 100, 500)
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.libraryId, libraryId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
  }

  /** Filter to a specific action within a tenant (newest first). */
  async listByLibraryAction(libraryId: string, action: string, opts: { limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 100, 500)
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.libraryId, libraryId), eq(auditLogs.action, action)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
  }

  /**
   * System-level audit entries (libraryId IS NULL) — cross-tenant ops like
   * tenant.create / tenant.setActive / tenant.update / tenant.delete. Super-admin
   * only (these have no tenant scope, so listByLibrary can never surface them).
   */
  async listSystem(opts: { limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 100, 500)
    return this.db
      .select()
      .from(auditLogs)
      .where(isNull(auditLogs.libraryId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
  }
}
