import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

export const listBooks = createServerFn({ method: 'GET' })
  .validator(
    z
      .object({
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const { requireTenant } = await import('@/server/auth/guards')
    const { BookService } = await import('@/server/services')
    const { db, libraryId } = await requireTenant()
    // ALWAYS scoped by the authenticated tenant.
    return new BookService(db).listByLibrary(libraryId, data ?? {})
  })

export const addBook = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      isbn: z.string().min(1),
      title: z.string().min(1),
      author: z.string().min(1),
      publisher: z.string().optional(),
      publishedYear: z.number().int().optional(),
      coverImageUrl: z.string().url().optional(),
      description: z.string().optional(),
      subjects: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/server/auth/guards')
    const { BookService } = await import('@/server/services')
    const { db, libraryId } = await requireAdmin()
    return new BookService(db).add({ ...data, libraryId })
  })

// Single book (tenant-scoped) for the detail / discovery page.
export const getBook = createServerFn({ method: 'GET' })
  .validator(z.object({ bookId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireTenant } = await import('@/server/auth/guards')
    const { BookService } = await import('@/server/services')
    const { db, libraryId } = await requireTenant()
    return new BookService(db).getById(data.bookId, libraryId)
  })

// Admin-only ISBN metadata lookup (Open Library). Returns null when not found,
// so the UI can fall back to manual entry with the scanned ISBN.
export const lookupIsbn = createServerFn({ method: 'GET' })
  .validator(z.object({ isbn: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/server/auth/guards')
    const { lookupBookMetadata } = await import('@/server/services/bookMetadata')
    await requireAdmin() // gate the external call behind admin auth
    return lookupBookMetadata(data.isbn)
  })
