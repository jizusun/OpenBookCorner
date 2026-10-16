import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

export const listBooks = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireTenant } = await import('@/server/auth/guards')
  const { BookService } = await import('@/server/services')
  const { db, libraryId } = await requireTenant()
  // ALWAYS scoped by the authenticated tenant.
  return new BookService(db).listByLibrary(libraryId)
})

export const addBook = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      isbn: z.string().min(1),
      title: z.string().min(1),
      author: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/server/auth/guards')
    const { BookService } = await import('@/server/services')
    const { db, libraryId } = await requireAdmin()
    return new BookService(db).add({ ...data, libraryId })
  })
