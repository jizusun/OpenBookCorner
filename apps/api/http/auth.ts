import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'

import type { AuthUser } from '../lib/auth'
import { membership } from '@obc/db'
import type { BaseVars } from '../lib/mw'
import { sessionAuth } from '../lib/mw'

function identity(user: AuthUser, resolvedRole?: string) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    libraryId: user.libraryId ?? null,
    activeLibraryId: user.activeLibraryId ?? user.libraryId ?? null,
    // ADR 0009: prefer the role from the active membership (which is set when
    // the user creates/joins a library) over the stale global user.role.
    role: resolvedRole ?? user.role ?? 'library_reader',
  }
}

/**
 * Auth identity. Sign-in/up/out are handled by Better Auth at /api/auth/*.
 * - GET /me returns the current identity or null (public: no guard).
 * - GET /require-me is guarded and 401s when unauthenticated (used by
 *   protected route loaders).
 */
export const authApp = new Hono<{ Variables: BaseVars }>()
  .get('/me', async (c) => {
    const data = await c.get('auth').api.getSession({ headers: c.req.raw.headers })
    return c.json(data?.user ? identity(data.user as AuthUser) : null)
  })
  .get('/require-me', sessionAuth, async (c) => {
    const user = c.get('user') as AuthUser
    const db = c.get('db')
    // ADR 0009: resolve role from the active membership so that users who
    // created a library (membership role = library_admin) see the correct
    // nav/surface even though user.role is still the default library_reader.
    const activeLibraryId = user.activeLibraryId ?? user.libraryId ?? null
    let resolvedRole: string | undefined
    if (activeLibraryId && user.role !== 'super_admin') {
      const m = await db
        .select({ role: membership.role })
        .from(membership)
        .where(and(eq(membership.userId, user.id), eq(membership.libraryId, activeLibraryId)))
        .get?.()
      if (m?.role) resolvedRole = m.role
    }
    return c.json(identity(user, resolvedRole))
  })
