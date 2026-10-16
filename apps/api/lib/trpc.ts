import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'

import type { TRPCContext } from './context'

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

/** Requires an authenticated session. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.user } })
})

/**
 * Requires an authenticated session scoped to a tenant (library). Enriches
 * context with a guaranteed `libraryId` + `role` for multi-tenant isolation.
 */
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  const libraryId = ctx.user.libraryId
  if (!libraryId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'NO_LIBRARY_ACCESS' })
  }
  return next({ ctx: { ...ctx, libraryId, role: ctx.user.role ?? 'library_reader' } })
})

/** Requires a tenant member with an admin role. */
export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.role !== 'library_admin' && ctx.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' })
  }
  return next({ ctx })
})
