import { z } from 'zod'

import { adminProcedure, router } from '../lib/trpc'
import { MemberService } from '../services'

/** Admin-only: list library members (番薯 成员). Tenant-scoped. */
export const memberRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => new MemberService(ctx.db).listByLibrary(ctx.libraryId, input ?? {})),
})
