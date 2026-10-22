import { createMiddleware } from 'hono/factory'
import { and, eq } from 'drizzle-orm'

import type { Auth, AuthSession, AuthUser } from './auth'
import { membership, type Database } from '@obc/db'
import type { Env } from './env'

/** Cloudflare native Rate Limiting binding (unsafe ratelimit). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Variables available on EVERY request (set by the Worker before routing):
 * the per-request Drizzle db, the Better Auth instance, the parsed env, and
 * (optionally) the public rate limiter binding.
 */
export type BaseVars = {
  db: Database
  auth: Auth
  env: Env
  email: import('../services/email').EmailService
  rateLimiter?: RateLimiter
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
/**
 * Rate-limit the UNAUTHENTICATED public endpoints (/api/public/*) using the
 * Workers native rate limiter, keyed by client IP (CF-Connecting-IP). Returns
 * 429 when exceeded. No-op when the binding is absent (e.g. local dev / tests),
 * so it never blocks local work. Per-location eventually-consistent counters —
 * basic abuse protection for the Free-plan D1 (ADR 0003).
 */
export const publicRateLimit = createMiddleware<{ Variables: BaseVars }>(async (c, next) => {
  const limiter = c.get('rateLimiter')
  if (limiter) {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'anon'
    const { success } = await limiter.limit({ key: `public:${ip}` })
    if (!success) return c.json({ error: 'RATE_LIMITED' }, 429)
  }
  await next()
})

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
 * Requires an authenticated session scoped to a tenant (library). Resolves the
 * tenant from the user's selected `activeLibraryId` (ADR 0009) and verifies the
 * user holds an ACTIVE membership in it — the role comes from that membership,
 * not the user row. super_admin is platform-scoped and bypasses the membership
 * check. During the 0009 transition we fall back to the legacy `user.libraryId`
 * when `activeLibraryId` is unset or a membership row isn't present yet. Must be
 * chained AFTER `sessionAuth`.
 */
export const tenant = createMiddleware<{ Variables: TenantVars }>(async (c, next) => {
  const user = c.get('user')
  const db = c.get('db')
  const libraryId = user.activeLibraryId ?? user.libraryId
  if (!libraryId) {
    return c.json({ error: 'NO_LIBRARY_ACCESS' }, 403)
  }

  // super_admin: platform scope — no membership required.
  if (user.role === 'super_admin') {
    c.set('libraryId', libraryId)
    c.set('role', 'super_admin')
    await next()
    return
  }

  // Resolve the user's active membership in this library (the isolation gate).
  const m = await db
    .select({ role: membership.role, status: membership.status })
    .from(membership)
    .where(and(eq(membership.userId, user.id), eq(membership.libraryId, libraryId)))
    .get?.()

  if (m) {
    if (m.status !== 'active') {
      return c.json({ error: 'NO_LIBRARY_ACCESS' }, 403)
    }
    c.set('libraryId', libraryId)
    c.set('role', m.role)
    await next()
    return
  }

  // Transition fallback: legacy user whose membership row isn't present yet but
  // whose user.libraryId still matches the target.
  if (user.libraryId === libraryId) {
    c.set('libraryId', libraryId)
    c.set('role', user.role ?? 'library_reader')
    await next()
    return
  }

  return c.json({ error: 'NO_LIBRARY_ACCESS' }, 403)
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
