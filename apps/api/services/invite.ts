import { and, eq, sql } from 'drizzle-orm'

import { invite, libraries, user, type Database, type Invite } from '@obc/db'
import { MembershipService } from './membership'

export interface InviteRow {
  id: string
  libraryId: string
  libraryName: string
  token: string
  role: string
  requiresApproval: boolean
  maxUses: number | null
  usedCount: number
  expiresAt: Date | null
  revoked: boolean
  createdAt: string
}

export interface ResolvedInvite {
  libraryId: string
  libraryName: string
  token: string
  role: string
  requiresApproval: boolean
  valid: true
}

/**
 * Invite-link management (ADR 0009 step 6). Token-only URLs: /join/<token>.
 * The token uniquely identifies the invite; no slug/id in the URL.
 */
export class InviteService {
  constructor(private db: Database) {}

  /** Resolve a token to an invite + library name, or null if invalid/expired/revoked/over-used. */
  async resolve(token: string): Promise<ResolvedInvite | null> {
    const row = await this.db
      .select({
        id: invite.id,
        libraryId: invite.libraryId,
        token: invite.token,
        role: invite.role,
        requiresApproval: invite.requiresApproval,
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        expiresAt: invite.expiresAt,
        revoked: invite.revoked,
        libraryName: libraries.name,
        libraryIsActive: libraries.isActive,
      })
      .from(invite)
      .innerJoin(libraries, eq(invite.libraryId, libraries.id))
      .where(eq(invite.token, token))
      .get?.()
    if (!row) return null
    if (row.revoked) return null
    if (!row.libraryIsActive) return null
    if (row.expiresAt && new Date() > new Date(row.expiresAt)) return null
    if (row.maxUses != null && row.usedCount >= row.maxUses) return null
    return {
      libraryId: row.libraryId,
      libraryName: row.libraryName,
      token: row.token,
      role: row.role,
      requiresApproval: Boolean(row.requiresApproval),
      valid: true,
    }
  }

  /**
   * Use an invite: if requiresApproval=false, create an active membership
   * immediately; otherwise create a pending join_request. Increments usedCount.
   */
  async use(
    token: string,
    userId: string,
    answers?: Record<string, string>,
  ): Promise<{ memberId?: string; requestId?: string; error?: string }> {
    const resolved = await this.resolve(token)
    if (!resolved) return { error: 'INVITE_INVALID' }

    // Server-side join-form validation before consuming the slot.
    const { MembershipService, validateJoinAnswers } = await import('./membership')
    const svc = new MembershipService(this.db)
    const fields = await svc.joinFields(resolved.libraryId)
    if (fields.length > 0) {
      const errors = validateJoinAnswers(fields, answers ?? {}, [])
      if (errors.length > 0) return { error: 'VALIDATION_FAILED' }
    }

    // Do NOT increment the slot before we know the action will succeed (prevents
    // exhausting maxUses on already-member or ALREADY_MEMBER errors).
    const { JoinRequestService } = await import('./join-request')

    if (!resolved.requiresApproval) {
      // Check already-member to avoid demoting an existing admin.
      const existing = await svc.activeMembership(userId, resolved.libraryId)
      if (existing) return { error: 'ALREADY_MEMBER' }

      // Consume the slot only now (after all pre-flight checks).
      await this.db
        .update(invite)
        .set({ usedCount: sql`${invite.usedCount} + 1` })
        .where(eq(invite.token, token))

      // Auto-join: create an active membership + set as active library.
      await svc.upsertActive(userId, resolved.libraryId, resolved.role as 'library_admin' | 'library_reader', answers)
      await this.db.update(user).set({ activeLibraryId: resolved.libraryId }).where(eq(user.id, userId))
      return { memberId: resolved.libraryId }
    }

    // Consume the slot for approval-required path too.
    await this.db
      .update(invite)
      .set({ usedCount: sql`${invite.usedCount} + 1` })
      .where(eq(invite.token, token))

    // Create a pending join request tagged with 'invite'.
    const jrSvc = new JoinRequestService(this.db)
    const res = await jrSvc.submit(userId, resolved.libraryId, 'invite', answers)
    if ('error' in res) {
      // Restore the slot if submission failed.
      await this.db
        .update(invite)
        .set({ usedCount: sql`${invite.usedCount} - 1` })
        .where(eq(invite.token, token))
      return { error: res.error }
    }
    return { requestId: res.id }
  }

  /** List invites for a library (admin). */
  async list(libraryId: string): Promise<InviteRow[]> {
    const rows =
      (await this.db
        .select({
          id: invite.id,
          libraryId: invite.libraryId,
          token: invite.token,
          role: invite.role,
          requiresApproval: invite.requiresApproval,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          expiresAt: invite.expiresAt,
          revoked: invite.revoked,
          createdAt: invite.createdAt,
          libraryName: libraries.name,
        })
        .from(invite)
        .innerJoin(libraries, eq(invite.libraryId, libraries.id))
        .where(eq(invite.libraryId, libraryId))
        .all?.()) ?? []
    return rows.map((r) => ({
      ...r,
      requiresApproval: Boolean(r.requiresApproval),
      revoked: Boolean(r.revoked),
      expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
      libraryName: r.libraryName,
    }))
  }

  /** Create a new invite for a library. Returns the token. */
  async create(
    libraryId: string,
    createdBy: string,
    opts: {
      role?: 'library_admin' | 'library_reader'
      requiresApproval?: boolean
      maxUses?: number
      expiresInDays?: number
    } = {},
  ): Promise<{ token: string }> {
    const token = crypto.getRandomValues(new Uint8Array(24))
      .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
      .slice(0, 32)
    const expiresAt = opts.expiresInDays
      ? new Date(Date.now() + opts.expiresInDays * 86_400_000)
      : null
    await this.db.insert(invite).values({
      id: crypto.randomUUID(),
      libraryId,
      token,
      role: opts.role ?? 'library_reader',
      requiresApproval: opts.requiresApproval ?? true,
      maxUses: opts.maxUses ?? null,
      usedCount: 0,
      expiresAt: expiresAt,
      revoked: false,
      createdBy,
      createdAt: new Date().toISOString(),
    })
    return { token }
  }

  /** Revoke an invite (admin). */
  async revoke(inviteId: string, libraryId: string): Promise<void> {
    await this.db
      .update(invite)
      .set({ revoked: true })
      .where(and(eq(invite.id, inviteId), eq(invite.libraryId, libraryId)))
  }
}
