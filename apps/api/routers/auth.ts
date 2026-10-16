import { protectedProcedure, publicProcedure, router } from '../lib/trpc'

/**
 * Auth router. Sign-in / sign-up / sign-out are handled by Better Auth's own
 * HTTP routes at /api/auth/*. This router only exposes the current identity.
 */
export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      libraryId: ctx.user.libraryId ?? null,
      role: ctx.user.role ?? 'library_reader',
    }
  }),

  // Convenience: throws if unauthenticated (used by protected loaders).
  requireMe: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    libraryId: ctx.user.libraryId ?? null,
    role: ctx.user.role ?? 'library_reader',
  })),
})
