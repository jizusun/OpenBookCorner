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
