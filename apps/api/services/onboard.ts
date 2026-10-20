import { and, eq } from 'drizzle-orm'

import { libraries, members, user, type Database } from '@obc/db'

import { AuditService } from './audit'

export type TenantRole = 'library_admin' | 'library_reader'

/** Creates a Better Auth account (password hashed) and returns its user id. */
export type CreateAccount = (input: {
  email: string
  name: string
  password: string
}) => Promise<{ userId: string }>

export interface CreateTenantUserInput {
  libraryId: string
  email: string
  name: string
  password: string
  role: TenantRole
  /** The REAL user performing the action (super admin or library admin). */
  actorUserId: string
}

export interface CreateTenantUserResult {
  userId?: string
  error?: 'EMAIL_TAKEN' | 'LIBRARY_NOT_FOUND' | 'INVALID_INPUT'
}

/**
 * Shared tenant-onboarding primitive. Creates a login account, scopes it to a
 * tenant with a fixed role, links a member record (so the person appears in the
 * member list and can borrow), and audits it. Used by BOTH the super-admin
 * "add admin" flow (role=library_admin, libraryId from path) and the library-
 * admin "add member" flow (role=library_reader, libraryId from session). The
 * actual account creation (password hashing) is injected so the pure
 * orchestration (validation, scoping, member link, audit) is unit-testable; the
 * real hash + login round-trip is covered by E2E.
 */
export async function createTenantUser(
  db: Database,
  createAccount: CreateAccount,
  input: CreateTenantUserInput,
): Promise<CreateTenantUserResult> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  if (!email || !name || !input.password) return { error: 'INVALID_INPUT' }

  // Tenant must exist.
  const lib = await db.select({ id: libraries.id }).from(libraries).where(eq(libraries.id, input.libraryId)).get()
  if (!lib) return { error: 'LIBRARY_NOT_FOUND' }

  // Email must be unique (Better Auth user.email is unique; fail early + clean).
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).get()
  if (existing) return { error: 'EMAIL_TAKEN' }

  // Create the login account (hashing happens inside the injected fn).
  const { userId } = await createAccount({ email, name, password: input.password })

  // Scope it to the tenant with the fixed role.
  await db.update(user).set({ libraryId: input.libraryId, role: input.role }).where(eq(user.id, userId))

  // Link a member record (idempotent-ish: skip if one already links this user).
  const existingMember = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.libraryId, input.libraryId), eq(members.userId, userId)))
    .get()
  if (!existingMember) {
    await db.insert(members).values({
      id: crypto.randomUUID(),
      libraryId: input.libraryId,
      name,
      role: input.role,
      email,
      userId,
      isPlaceholder: false,
      createdAt: new Date().toISOString(),
    })
  }

  // Audit: real actor, tenant-scoped, new user as target.
  await new AuditService(db).log({
    actorUserId: input.actorUserId,
    libraryId: input.libraryId,
    action: input.role === 'library_admin' ? 'tenant.addAdmin' : 'member.create',
    targetType: 'user',
    targetId: userId,
  })

  return { userId }
}


export interface EnableMemberLoginInput {
  memberId: string
  libraryId: string
  email: string
  password: string
  actorUserId: string
}

export interface EnableMemberLoginResult {
  userId?: string
  error?: 'MEMBER_NOT_FOUND' | 'ALREADY_LINKED' | 'EMAIL_TAKEN' | 'INVALID_INPUT'
}

/**
 * Provision-on-demand (ADR 0006): give an EXISTING member (e.g. a 番薯-imported
 * reader) a login account and link it — rather than importing accounts. Creates
 * a library_reader user scoped to the member's library, named after the member,
 * and sets members.userId. The member must belong to `libraryId` (session tenant)
 * and must not already be linked. `createAccount` is injected (hashing).
 */
export async function enableMemberLogin(
  db: Database,
  createAccount: CreateAccount,
  input: EnableMemberLoginInput,
): Promise<EnableMemberLoginResult> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.password) return { error: 'INVALID_INPUT' }

  const member = await db
    .select({ id: members.id, name: members.name, userId: members.userId })
    .from(members)
    .where(and(eq(members.id, input.memberId), eq(members.libraryId, input.libraryId)))
    .get()
  if (!member) return { error: 'MEMBER_NOT_FOUND' }
  if (member.userId) return { error: 'ALREADY_LINKED' }

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).get()
  if (existing) return { error: 'EMAIL_TAKEN' }

  const { userId } = await createAccount({ email, name: member.name, password: input.password })
  await db
    .update(user)
    .set({ libraryId: input.libraryId, role: 'library_reader' })
    .where(eq(user.id, userId))
  await db.update(members).set({ userId }).where(eq(members.id, input.memberId))

  await new AuditService(db).log({
    actorUserId: input.actorUserId,
    libraryId: input.libraryId,
    action: 'member.enableLogin',
    targetType: 'user',
    targetId: userId,
  })

  return { userId }
}