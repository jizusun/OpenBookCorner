import { createMiddleware } from 'hono/factory'

import type { Auth, AuthSession, AuthUser } from './auth'
import type { Database } from '@obc/db'
import type { Env } from './env'

/**
 * Variables available on EVERY request (set by the Worker before routing):
 * the per-request Drizzle db, the Better Auth instance, and the parsed env.
 */
export type BaseVars = {
  db: Database
  auth: Auth
  env: Env
}

/** After `sessionAuth`: a guaranteed authenticated user + session. */
export type AuthedVars = BaseVars & {
  user: AuthUser
  session: AuthSession
}

/** After `tenant`: a guaranteed tenant scope derived from the session. */
export type TenantVars = AuthedVars & {
  libraryId: string
  role: string
}

/**
 * Multi-tenancy guards, best-practice style:
 * - Isolation lives in MIDDLEWARE, not in handler if-statements.
 * - The tenant (`libraryId`) is derived ONLY from the verified Better Auth
 *   session — never from client input (no header/body/param tenant switching).
 * - Each guard is a typed `createMiddleware`, so a handler mounted behind it
 *   gets `c.get('libraryId')` / `c.get('user')` with the right type, and the
 *   value is ONLY present after the guard ran.
 * - Guards are attached at the SUB-APP level (one `.use()` per concern), so you
 *   cannot define a tenant route without its guard.
 */

/** Requires an authenticated session; sets `user` + `session`. */
export const sessionAuth = createMiddleware<{ Variables: AuthedVars }>(async (c, next) => {
  const auth = c.get('auth')
  const data = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!data?.user || !data.session) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  c.set('user', data.user as AuthUser)
  c.set('session', data.session as AuthSession)
  await next()
})

/**
 * Requires an authenticated session scoped to a tenant (library). Derives
 * `libraryId` + `role` from the session for multi-tenant isolation. Must be
 * chained AFTER `sessionAuth`.
 */
export const tenant = createMiddleware<{ Variables: TenantVars }>(async (c, next) => {
  const user = c.get('user')
  const libraryId = user.libraryId
  if (!libraryId) {
    return c.json({ error: 'NO_LIBRARY_ACCESS' }, 403)
  }
  c.set('libraryId', libraryId)
  c.set('role', user.role ?? 'library_reader')
  await next()
})

/** Requires a tenant member with an admin role. Chain AFTER `tenant`. */
export const admin = createMiddleware<{ Variables: TenantVars }>(async (c, next) => {
  const role = c.get('role')
  if (role !== 'library_admin' && role !== 'super_admin') {
    return c.json({ error: 'FORBIDDEN' }, 403)
  }
  await next()
})

/**
 * Requires a super admin. NOT tenant-scoped: super admins manage libraries
 * across the whole system, so this chains after `sessionAuth` only (no
 * libraryId filter). Never mount tenant-scoped data behind this.
 */
export const superAdmin = createMiddleware<{ Variables: AuthedVars }>(async (c, next) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') {
    return c.json({ error: 'SUPER_ADMIN_REQUIRED' }, 403)
  }
  await next()
})

/**
 * NOTE: path-based tenancy (ADR 0003, `/t/:slug`). The API is same-origin and
 * scoped purely by the session `libraryId` (see `tenant`), so there is NO
 * server-side host/path tenant guard. The `/t/:slug` segment is a client
 * routing + branding concern; the session remains the sole isolation boundary.
 */
