import { z } from 'zod'
import { TRPCError } from '@trpc/server'

import { adminProcedure, router } from '../lib/trpc'
import { MemberService } from '../services'

/** Admin-only: library members (番薯 成员). Tenant-scoped. */
export const memberRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(200).optional(),
          sortBy: z.enum(['name', 'joinedAt', 'borrowedCount', 'memberExpiry']).optional(),
          sortDir: z.enum(['asc', 'desc']).optional(),
          role: z.enum(['library_admin', 'library_reader']).optional(),
          plan: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => new MemberService(ctx.db).listByLibrary(ctx.libraryId, input ?? {})),

  facets: adminProcedure.query(({ ctx }) => new MemberService(ctx.db).listFacets(ctx.libraryId)),

  get: adminProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const m = await new MemberService(ctx.db).getById(input.memberId, ctx.libraryId)
      if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'MEMBER_NOT_FOUND' })
      return m
    }),
})
