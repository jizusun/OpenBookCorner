import { z } from 'zod'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { FeedbackService } from '../services'

export const feedbackRouter = router({
  // Any authenticated member can submit feedback.
  submit: tenantProcedure
    .input(
      z.object({
        category: z.enum(['feature_request', 'bug', 'book_suggestion', 'other']),
        message: z.string().min(1).max(2000),
      }),
    )
    .mutation(({ ctx, input }) =>
      new FeedbackService(ctx.db).submit({
        libraryId: ctx.libraryId,
        userId: ctx.user.id,
        category: input.category,
        message: input.message,
      }),
    ),

  // Admin: list all feedback for the library.
  list: adminProcedure.query(({ ctx }) => new FeedbackService(ctx.db).listByLibrary(ctx.libraryId)),
})
