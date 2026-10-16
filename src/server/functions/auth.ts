import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

// Phase 1: email/password login. Sets an HttpOnly session cookie.
// All server-only imports are done INSIDE handlers so this module is safe to import
// from client-reachable route files (the TanStack compiler strips handler bodies).
export const login = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().email(), password: z.string().min(8) }))
  .handler(async ({ data }) => {
    const { getDb } = await import('@/db')
    const { UserService } = await import('@/server/services')
    const { verifyPassword } = await import('@/server/auth/password')
    const { createSession } = await import('@/server/auth/session')
    const { setSessionCookie } = await import('@/server/http')

    const db = getDb()
    const user = await new UserService(db).findByEmail(data.email)
    if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, data.password))) {
      throw new Error('Invalid email or password')
    }

    const session = await createSession(db, user.id)
    setSessionCookie(session.id)

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      libraryId: user.libraryId,
      role: user.role,
    }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireUser } = await import('@/server/auth/guards')
  const { invalidateSession } = await import('@/server/auth/session')
  const { clearSessionCookie } = await import('@/server/http')
  const ctx = await requireUser()
  await invalidateSession(ctx.db, ctx.sessionId)
  clearSessionCookie()
  return { success: true }
})

export const me = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireUser } = await import('@/server/auth/guards')
  const { user } = await requireUser()
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    libraryId: user.libraryId,
    role: user.role,
  }
})
