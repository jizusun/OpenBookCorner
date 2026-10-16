import { z } from 'zod'
import { TRPCError } from '@trpc/server'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { LibraryService } from '../services'

export const libraryRouter = router({
  settings: tenantProcedure.query(async ({ ctx }) => {
    const lib = await new LibraryService(ctx.db).get(ctx.libraryId)
    if (!lib) throw new TRPCError({ code: 'NOT_FOUND', message: 'LIBRARY_NOT_FOUND' })
    return {
      name: lib.name,
      emailDomains: lib.emailDomains,
      settings: lib.settings,
    }
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        borrowingPeriodDays: z.number().int().min(1).max(365),
        maxBooksPerReader: z.number().int().min(1).max(100),
        allowExtensions: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) => new LibraryService(ctx.db).updateSettings(ctx.libraryId, input)),
})
