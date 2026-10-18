import { Hono } from 'hono'

import type { AuthUser } from '../lib/auth'
import type { BaseVars } from '../lib/mw'
import { sessionAuth } from '../lib/mw'

function identity(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    libraryId: user.libraryId ?? null,
    role: user.role ?? 'library_reader',
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
  .get('/require-me', sessionAuth, (c) => c.json(identity(c.get('user'))))
