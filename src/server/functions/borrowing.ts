import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

export const borrowBook = createServerFn({ method: 'POST' })
  .validator(z.object({ bookId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireTenant } = await import('@/server/auth/guards')
    const { CirculationService } = await import('@/server/services')
    const { db, user, libraryId } = await requireTenant()
    return new CirculationService(db).borrow(data.bookId, user.id, libraryId)
  })

export const returnBook = createServerFn({ method: 'POST' })
  .validator(z.object({ transactionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireTenant } = await import('@/server/auth/guards')
    const { CirculationService } = await import('@/server/services')
    const { db, user, libraryId } = await requireTenant()
    return new CirculationService(db).returnBook(data.transactionId, user.id, libraryId)
  })

export const myBooks = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireTenant } = await import('@/server/auth/guards')
  const { CirculationService } = await import('@/server/services')
  const { db, user, libraryId } = await requireTenant()
  return new CirculationService(db).myBooks(user.id, libraryId)
})

// Admin-only overdue management view, tenant-scoped, filterable by days-overdue range.
export const listOverdue = createServerFn({ method: 'GET' })
  .validator(z.object({ range: z.enum(['1-7', '8-14', '15+', 'all']).optional() }).optional())
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/server/auth/guards')
    const { CirculationService } = await import('@/server/services')
    const { db, libraryId } = await requireAdmin()
    return new CirculationService(db).listOverdue(libraryId, data?.range ?? 'all')
  })
