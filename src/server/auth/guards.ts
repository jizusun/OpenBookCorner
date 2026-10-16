import { getRequestHeader } from '@tanstack/react-start/server'
import { getDb, type Db } from '@/db'
import { readSessionCookie, validateSession } from '@/server/auth/session'
import type { User } from '@/db/schema'

// In-handler guards. These are CALLED INSIDE server-function handlers (never at module scope),
// so their server-only imports are stripped from the client bundle by the TanStack compiler.
// This is the official pattern (see start-basic-auth example) and keeps Phase 1 KISS.

export interface AuthedContext {
  db: Db
  user: User
  sessionId: string
}

/** Require a valid session. Throws UNAUTHORIZED otherwise. */
export async function requireUser(): Promise<AuthedContext> {
  const db = getDb()
  const sessionId = readSessionCookie(getRequestHeader('cookie') ?? null)
  if (!sessionId) throw new Error('UNAUTHORIZED')

  const validated = await validateSession(db, sessionId)
  if (!validated) throw new Error('UNAUTHORIZED')

  return { db, user: validated.user, sessionId: validated.sessionId }
}

export interface TenantContext extends AuthedContext {
  libraryId: string
}

/** Require a valid session scoped to a tenant (multi-tenant isolation). */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await requireUser()
  if (!ctx.user.libraryId) throw new Error('NO_LIBRARY_ACCESS')
  return { ...ctx, libraryId: ctx.user.libraryId }
}

/** Require an admin (library_admin / super_admin), tenant-scoped. */
export async function requireAdmin(): Promise<TenantContext> {
  const ctx = await requireTenant()
  if (ctx.user.role !== 'library_admin' && ctx.user.role !== 'super_admin') {
    throw new Error('Insufficient permissions')
  }
  return ctx
}
