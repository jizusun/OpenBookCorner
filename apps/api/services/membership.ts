import { and, eq } from 'drizzle-orm'

import { membership, joinField, type Database, type Membership, type JoinField } from '@obc/db'

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

  /** A library's join-form fields, ordered. */
  async joinFields(libraryId: string): Promise<JoinField[]> {
    const rows =
      (await this.db.select().from(joinField).where(eq(joinField.libraryId, libraryId)).all?.()) ?? []
    return rows.sort((a, b) => a.position - b.position)
  }
}

export interface JoinAnswerError {
  key: string
  reason: 'required' | 'invalid_email' | 'email_not_verified'
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
  fields: Pick<JoinField, 'key' | 'type' | 'required' | 'verifyEmail'>[],
  answers: Record<string, string>,
  verifiedEmails: string[] = [],
): JoinAnswerError[] {
  const errors: JoinAnswerError[] = []
  const verified = new Set(verifiedEmails.map((e) => e.trim().toLowerCase()))
  for (const f of fields) {
    const raw = answers[f.key]
    const val = (raw ?? '').trim()
    if (!val) {
      if (f.required) errors.push({ key: f.key, reason: 'required' })
      continue
    }
    if (f.type === 'email') {
      // minimal shape check; the real gate is ownership verification below
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
        errors.push({ key: f.key, reason: 'invalid_email' })
        continue
      }
      if (f.verifyEmail && !verified.has(val.toLowerCase())) {
        errors.push({ key: f.key, reason: 'email_not_verified' })
      }
    }
  }
  return errors
}
