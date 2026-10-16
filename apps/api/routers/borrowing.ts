import { z } from 'zod'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { CirculationService } from '../services'

export const borrowingRouter = router({
  borrow: tenantProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      new CirculationService(ctx.db).borrow(input.bookId, ctx.user.id, ctx.libraryId),
    ),

  borrowByIsbn: tenantProcedure
    .input(z.object({ isbn: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      new CirculationService(ctx.db).borrowByIsbn(input.isbn, ctx.user.id, ctx.libraryId),
    ),

  return: tenantProcedure
    .input(z.object({ transactionId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      new CirculationService(ctx.db).returnBook(input.transactionId, ctx.user.id, ctx.libraryId),
    ),

  myBooks: tenantProcedure.query(({ ctx }) =>
    new CirculationService(ctx.db).myBooks(ctx.user.id, ctx.libraryId),
  ),

  listOverdue: adminProcedure
    .input(z.object({ range: z.enum(['1-7', '8-14', '15+', 'all']).optional() }).optional())
    .query(({ ctx, input }) =>
      new CirculationService(ctx.db).listOverdue(ctx.libraryId, input?.range ?? 'all'),
    ),
})
