import { and, eq } from 'drizzle-orm'

import {
  membership,
  joinField,
  libraries,
  user,
  type Database,
  type Membership,
  type JoinField,
} from '@obc/db'

export interface UserLibraryRow {
  libraryId: string
  name: string
  role: 'library_admin' | 'library_reader'
  active: boolean
}

/**
 * Multi-library membership (ADR 0009). A membership is the relationship between
 * a user and a library (role + lifecycle status). A user may hold several.
 * Tenant scope for a request resolves to the user's ACTIVE membership in their
 * active library.
 */
export class MembershipService {
  constructor(private db: Database) {}

  /** All of a user's memberships (any status). */
  async listForUser(userId: string): Promise<Membership[]> {
    return this.db.select().from(membership).where(eq(membership.userId, userId)).all?.() ?? []
  }

  /** The user's ACTIVE membership in a library, or null. Drives tenant access. */
  async activeMembership(userId: string, libraryId: string): Promise<Membership | null> {
    const row = await this.db
      .select()
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.libraryId, libraryId)))
      .get?.()
    if (!row || row.status !== 'active') return null
    return row
  }

  /** Create (or reactivate) an active membership. Idempotent per (user, library). */
  async upsertActive(
    userId: string,
    libraryId: string,
    role: 'library_admin' | 'library_reader',
    joinFields?: Record<string, string>,
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.libraryId, libraryId)))
      .get?.()
    const now = new Date().toISOString()
    if (existing) {
      await this.db
        .update(membership)
        .set({ role, status: 'active', joinFields: joinFields ?? existing.joinFields, updatedAt: now })
        .where(eq(membership.id, existing.id))
      return
    }
    await this.db.insert(membership).values({
      id: crypto.randomUUID(),
      userId,
      libraryId,
      role,
      status: 'active',
      joinFields: joinFields ?? null,
      createdAt: now,
      updatedAt: now,
    })
  }

  /** All active memberships in a library, enriched with user name + email. */
  async listByLibrary(libraryId: string): Promise<Array<{
    userId: string; name: string; email: string; role: string; joinedAt: string
  }>> {
    const rows = await this.db
      .select({
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.createdAt,
        name: user.name,
        email: user.email,
      })
      .from(membership)
      .innerJoin(user, eq(membership.userId, user.id))
      .where(and(eq(membership.libraryId, libraryId), eq(membership.status, 'active')))
      .all?.() ?? []
    return rows
  }

  /**
   * Admin removes a user from a library (sets membership to 'removed').
   * Returns false if the membership doesn't exist.
   */
  async removeFromLibrary(userId: string, libraryId: string): Promise<boolean> {
    const m = await this.db
      .select({ id: membership.id })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.libraryId, libraryId)))
      .get?.()
    if (!m) return false
    await this.db
      .update(membership)
      .set({ status: 'removed', updatedAt: new Date().toISOString() })
      .where(eq(membership.id, m.id))
    return true
  }

  /**
   * User leaves their own library. Clears active_library_id if it was this
   * library so the app redirects to /welcome on next load.
   */
  async leaveLibrary(userId: string, libraryId: string): Promise<boolean> {
    const removed = await this.removeFromLibrary(userId, libraryId)
    if (!removed) return false
    // If this was the active library, clear it so the user is sent to /welcome.
    const u = await this.db
      .select({ activeLibraryId: user.activeLibraryId })
      .from(user)
      .where(eq(user.id, userId))
      .get?.()
    if (u?.activeLibraryId === libraryId) {
      // Try to switch to another active membership; else clear.
      const others = await this.listUserLibraries(userId)
      const next = others.find((l) => l.libraryId !== libraryId)
      await this.db
        .update(user)
        .set({ activeLibraryId: next?.libraryId ?? null })
        .where(eq(user.id, userId))
    }
    return true
  }

  /** A library's join-form fields, ordered. */
  async joinFields(libraryId: string): Promise<JoinField[]> {
    const rows =
      (await this.db.select().from(joinField).where(eq(joinField.libraryId, libraryId)).all?.()) ?? []
    return rows.sort((a, b) => a.position - b.position)
  }

  /**
   * The libraries a user belongs to (active memberships only), with the
   * library name + role + whether it's the user's currently-active one. Drives
   * the top-left switcher and the post-signup "create or join" empty state.
   */
  async listUserLibraries(userId: string): Promise<UserLibraryRow[]> {
    const u = await this.db
      .select({ activeLibraryId: user.activeLibraryId })
      .from(user)
      .where(eq(user.id, userId))
      .get?.()
    const activeId = u?.activeLibraryId ?? null
    const rows =
      (await this.db
        .select({
          libraryId: membership.libraryId,
          role: membership.role,
          status: membership.status,
          name: libraries.name,
        })
        .from(membership)
        .innerJoin(libraries, eq(membership.libraryId, libraries.id))
        .where(eq(membership.userId, userId))
        .all?.()) ?? []
    return rows
      .filter((r) => r.status === 'active')
      .map((r) => ({
        libraryId: r.libraryId,
        name: r.name,
        role: r.role as 'library_admin' | 'library_reader',
        active: r.libraryId === activeId,
      }))
  }

  /**
   * Set the user's active library. Requires an ACTIVE membership there
   * (prevents switching into a library you don't belong to — isolation).
   */
  async switchActive(userId: string, libraryId: string): Promise<boolean> {
    const m = await this.activeMembership(userId, libraryId)
    if (!m) return false
    await this.db.update(user).set({ activeLibraryId: libraryId }).where(eq(user.id, userId))
    return true
  }

  /**
   * Create a library and make the creator its admin, in one step: insert the
   * library, create an ACTIVE admin membership, and set it as the user's active
   * library. Returns the new library id/slug.
   */
  async createLibraryAsAdmin(
    userId: string,
    input: { name: string; emailDomains: string[] },
  ): Promise<{ id: string; slug: string | null }> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const slug = slugifyUnique(input.name)
    await this.db.insert(libraries).values({
      id,
      name: input.name,
      slug,
      emailDomains: input.emailDomains,
      settings: { borrowingPeriodDays: 14, maxBooksPerReader: 5, allowExtensions: false },
      isActive: true,
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
    })
    await this.upsertActive(userId, id, 'library_admin')
    await this.db.update(user).set({ activeLibraryId: id }).where(eq(user.id, userId))
    return { id, slug }
  }
}

/** Minimal slug derivation for a newly-created library (uniqueness best-effort). */
function slugifyUnique(name: string): string | null {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 34)
    .replace(/-+$/g, '')
  if (base.length < 2) return null
  // Append a short random suffix to avoid collisions without a DB round-trip.
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

export interface JoinAnswerError {
  key: string
  reason: 'required' | 'invalid_email' | 'email_not_verified' | 'domain_not_allowed'
}

/**
 * Pure validation of a join-form submission against a library's field schema
 * (ADR 0009). Returns the list of problems ([] = valid). A request with any
 * problem must NOT be submittable. Kept pure so it's unit-tested exhaustively
 * and shared by client + server.
 *
 * @param verifiedEmails lowercased emails the applicant has proven ownership of
 *   (for fields with verifyEmail=true).
 */
export function validateJoinAnswers(
  fields: Pick<JoinField, 'key' | 'type' | 'required' | 'verifyEmail' | 'allowedDomains'>[],
  answers: Record<string, string>,
  verifiedEmails: string[] = [],
): JoinAnswerError[] {
  const errors: JoinAnswerError[] = []
  for (const f of fields) {
    const raw = answers[f.key]
    const val = (raw ?? '').trim()
    if (!val) {
      if (f.required) errors.push({ key: f.key, reason: 'required' })
      continue
    }
    if (f.type === 'email') {
      // Shape check only.
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
        errors.push({ key: f.key, reason: 'invalid_email' })
        continue
      }
      // Domain allowlist — only checked when allowedDomains is non-empty.
      const allowed = f.allowedDomains
      if (allowed && allowed.length > 0) {
        const lower = val.toLowerCase()
        const ok = allowed.some((d) => lower.endsWith(d.toLowerCase()))
        if (!ok) errors.push({ key: f.key, reason: 'domain_not_allowed' })
      }
      // Note: verifiedEmails param is kept for forward compat with Phase 2 OTP.
      void verifiedEmails
    }
  }
  return errors
}
