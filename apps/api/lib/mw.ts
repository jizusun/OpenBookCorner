import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'

import { libraries } from '@obc/db'

import type { Auth, AuthSession, AuthUser } from './auth'
import type { Database } from '@obc/db'
import type { Env } from './env'
import { resolveTenantHost } from './tenant'

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
 * Per-tenant subdomain enforcement (ADR 0003 §3/§5). Runs AFTER `sessionAuth`
 * (needs the verified `user`), BEFORE `tenant`. It uses the request Host — which
 * is branding + the *expected* tenant, NEVER the source of truth — to add a
 * guard on top of the session-derived isolation:
 *
 *  - apex / reserved / foreign host → NO tenant constraint (normal guards run).
 *  - super_admin on a tenant host  → 409 REDIRECT_TO_APEX. Super admins belong
 *    to no single tenant; tenant subdomains are members-only. The frontend reads
 *    this code and redirects the super admin to the apex (never a silent
 *    cross-tenant login — ADR 0003 §5).
 *  - any other user whose session `libraryId` !== the host tenant's library
 *    (including an unknown/inactive slug) → 403 WRONG_TENANT.
 *
 * `user.libraryId` from the session remains the ONLY isolation source of truth;
 * this guard can reject but never widen access.
 */
export const tenantHostGuard = createMiddleware<{ Variables: AuthedVars }>(async (c, next) => {
  const env = c.get('env')
  const baseDomain = env.TENANT_BASE_DOMAIN ?? new URL(env.APP_ORIGIN).hostname
  const host = c.req.header('host') ?? new URL(c.req.url).host
  const slug = resolveTenantHost(host, baseDomain)
  if (!slug) {
    // Apex / reserved / foreign host: no subdomain constraint.
    await next()
    return
  }

  const user = c.get('user')
  if (user.role === 'super_admin') {
    // Members-only host: signal the frontend to send the super admin to the apex.
    return c.json({ error: 'REDIRECT_TO_APEX' }, 409)
  }

  // Resolve the host's tenant and require the session user to belong to it.
  const lib = await c
    .get('db')
    .select({ id: libraries.id })
    .from(libraries)
    .where(eq(libraries.slug, slug))
    .get()
  if (!lib || user.libraryId !== lib.id) {
    return c.json({ error: 'WRONG_TENANT' }, 403)
  }
  await next()
})
