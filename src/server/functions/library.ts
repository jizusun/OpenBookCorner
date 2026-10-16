import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'

// Current user's library + settings (any authenticated member can read).
export const getLibrarySettings = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireTenant } = await import('@/server/auth/guards')
  const { LibraryService } = await import('@/server/services')
  const { db, libraryId } = await requireTenant()
  const lib = await new LibraryService(db).get(libraryId)
  if (!lib) throw new Error('LIBRARY_NOT_FOUND')
  return {
    id: lib.id,
    name: lib.name,
    emailDomains: lib.emailDomains,
    settings: lib.settings,
  }
})

// Admin: update library name + borrowing policy.
export const updateLibrarySettings = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().min(1),
      borrowingPeriodDays: z.number().int().min(1).max(365),
      maxBooksPerReader: z.number().int().min(1).max(100),
      allowExtensions: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/server/auth/guards')
    const { LibraryService } = await import('@/server/services')
    const { db, libraryId } = await requireAdmin()
    return new LibraryService(db).updateSettings(libraryId, data)
  })
