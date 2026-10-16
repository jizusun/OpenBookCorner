import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

// Submit feedback — any authenticated member, scoped to their library + user.
export const submitFeedback = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      category: z.enum(['feature_request', 'bug', 'book_suggestion', 'other']).default('other'),
      message: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const { requireTenant } = await import('@/server/auth/guards')
    const { FeedbackService } = await import('@/server/services')
    const { db, user, libraryId } = await requireTenant()
    return new FeedbackService(db).submit({
      libraryId,
      userId: user.id,
      category: data.category,
      message: data.message.trim(),
    })
  })

// Admin: list feedback for the library.
export const listFeedback = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdmin } = await import('@/server/auth/guards')
  const { FeedbackService } = await import('@/server/services')
  const { db, libraryId } = await requireAdmin()
  return new FeedbackService(db).listByLibrary(libraryId)
})
