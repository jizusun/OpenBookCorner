import { and, eq, ne } from 'drizzle-orm'

import {
  libraries,
  membership,
  joinRequest,
  user,
  type Database,
  type JoinRequest,
  type Library,
} from '@obc/db'

export interface PublicLibraryRow {
  id: string
  name: string
  slug: string | null
  memberCount?: number
}

export interface PendingRequestRow {
  id: string
  userId: string
  userName: string
  userEmail: string
  libraryId: string
  via: string
  answers: Record<string, string> | null
  createdAt: string
}

/**
 * Join-request management (ADR 0009 step 4). Covers:
 * - Discovering public libraries a user can request to join.
 * - Submitting a request (button or invite).
 * - Admin listing/approving/rejecting pending requests.
 */
export class JoinRequestService {
  constructor(private db: Database) {}

  /** Public libraries visible to anyone; excludes ones the user already belongs to. */
  async discoverPublic(userId: string): Promise<PublicLibraryRow[]> {
    const joined = (
      await this.db
        .select({ libraryId: membership.libraryId })
        .from(membership)
        .where(and(eq(membership.userId, userId), ne(membership.status, 'removed')))
        .all?.() ?? []
    ).map((r) => r.libraryId)

    const rows =
      (await this.db
        .select({ id: libraries.id, name: libraries.name, slug: libraries.slug })
        .from(libraries)
        .where(and(eq(libraries.visibility, 'public'), eq(libraries.isActive, true)))
        .all?.()) ?? []

    return rows.filter((r) => !joined.includes(r.id))
  }

  /**
   * Submit a join request. Validates:
   * - Library must be public (for button flow).
   * - User must not already have an active membership or pending request.
   */
  async submit(
    userId: string,
    libraryId: string,
    via: 'button' | 'invite',
    answers?: Record<string, string>,
  ): Promise<{ id: string } | { error: string }> {
    // Already a member?
    const existing = await this.db
      .select({ status: membership.status })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.libraryId, libraryId)))
      .get?.()
    if (existing?.status === 'active') return { error: 'ALREADY_MEMBER' }

    // Already a pending request?
    const pending = await this.db
      .select({ id: joinRequest.id })
      .from(joinRequest)
      .where(
        and(
          eq(joinRequest.userId, userId),
          eq(joinRequest.libraryId, libraryId),
          eq(joinRequest.status, 'pending'),
        ),
      )
      .get?.()
    if (pending) return { error: 'REQUEST_PENDING' }

    const id = crypto.randomUUID()
    await this.db.insert(joinRequest).values({
      id,
      userId,
      libraryId,
      via,
      answers: answers ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
    return { id }
  }

  /** Pending requests for a library (admin view), enriched with user name/email. */
  async listPending(libraryId: string): Promise<PendingRequestRow[]> {
    const rows =
      (await this.db
        .select({
          id: joinRequest.id,
          userId: joinRequest.userId,
          libraryId: joinRequest.libraryId,
          via: joinRequest.via,
          answers: joinRequest.answers,
          createdAt: joinRequest.createdAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(joinRequest)
        .innerJoin(user, eq(joinRequest.userId, user.id))
        .where(
          and(eq(joinRequest.libraryId, libraryId), eq(joinRequest.status, 'pending')),
        )
        .all?.()) ?? []
    return rows.map((r) => ({
      ...r,
      answers: (r.answers as Record<string, string> | null) ?? null,
    }))
  }

  /** Approve: create an active membership + mark request approved. Scoped to `libraryId`. */
  async approve(
    requestId: string,
    decidedBy: string,
    libraryId: string,
  ): Promise<{ error: string } | { success: true }> {
    const req = await this.db
      .select()
      .from(joinRequest)
      .where(and(
        eq(joinRequest.id, requestId),
        eq(joinRequest.status, 'pending'),
        eq(joinRequest.libraryId, libraryId), // scoped to admin's library
      ))
      .get?.()
    if (!req) return { error: 'REQUEST_NOT_FOUND' }

    const now = new Date().toISOString()
    // Upsert: reactivate if previously removed, or insert new.
    const existing = await this.db
      .select({ id: membership.id })
      .from(membership)
      .where(and(eq(membership.userId, req.userId), eq(membership.libraryId, req.libraryId)))
      .get?.()
    if (existing) {
      await this.db
        .update(membership)
        .set({ status: 'active', role: 'library_reader', joinFields: (req.answers as Record<string, string> | null) ?? null, updatedAt: now })
        .where(eq(membership.id, existing.id))
    } else {
      await this.db
        .insert(membership)
        .values({
          id: crypto.randomUUID(),
          userId: req.userId,
          libraryId: req.libraryId,
          role: 'library_reader',
          status: 'active',
          joinFields: (req.answers as Record<string, string> | null) ?? null,
          createdAt: now,
          updatedAt: now,
        })
    }
    // Mark approved (only if still pending — prevent overwriting a concurrent reject)
    await this.db
      .update(joinRequest)
      .set({ status: 'approved', decidedBy, decidedAt: now })
      .where(and(eq(joinRequest.id, requestId), eq(joinRequest.status, 'pending')))
    return { success: true }
  }

  /** Reject: mark request rejected. Scoped to `libraryId`. */
  async reject(
    requestId: string,
    decidedBy: string,
    libraryId: string,
  ): Promise<{ error: string } | { success: true }> {
    const now = new Date().toISOString()
    const result = await this.db
      .update(joinRequest)
      .set({ status: 'rejected', decidedBy, decidedAt: now })
      .where(and(eq(joinRequest.id, requestId), eq(joinRequest.status, 'pending'), eq(joinRequest.libraryId, libraryId)))
    if (!result) return { error: 'REQUEST_NOT_FOUND' }
    return { success: true }
  }

  /** Cancel own pending request. */
  async cancel(requestId: string, userId: string): Promise<{ error: string } | { success: true }> {
    const now = new Date().toISOString()
    await this.db
      .update(joinRequest)
      .set({ status: 'cancelled', decidedAt: now })
      .where(
        and(
          eq(joinRequest.id, requestId),
          eq(joinRequest.userId, userId),
          eq(joinRequest.status, 'pending'),
        ),
      )
    return { success: true }
  }
}
