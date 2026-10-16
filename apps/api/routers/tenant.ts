import { z } from 'zod'

import { router, superAdminProcedure } from '../lib/trpc'
import { TenantAdminService } from '../services'

/** Super-admin only: cross-tenant library (tenant) management. */
export const tenantRouter = router({
  list: superAdminProcedure.query(({ ctx }) => new TenantAdminService(ctx.db).listAll()),

  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        emailDomains: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(({ ctx, input }) => new TenantAdminService(ctx.db).create(input)),

  setActive: superAdminProcedure
    .input(z.object({ libraryId: z.string().min(1), isActive: z.boolean() }))
    .mutation(({ ctx, input }) =>
      new TenantAdminService(ctx.db).setActive(input.libraryId, input.isActive),
    ),
})
