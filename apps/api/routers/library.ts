import { z } from 'zod'
import { TRPCError } from '@trpc/server'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { LibraryService } from '../services'
import { FanshuImportService, fetchFanshuWorkbook, previewFanshuImport } from '../services/fanshuImport'

// A sheet is an array of row objects keyed by the 番薯 Chinese headers. We accept
// unknown record shapes (transforms + raw JSON tolerate any columns) but cap
// sizes so a client cannot send an unbounded payload.
const sheet = z.array(z.record(z.string(), z.unknown())).max(10000)
const fanshuSheets = z.object({
  books: sheet,
  stock: sheet,
  members: sheet,
  loans: sheet,
  reviews: sheet,
  purchaseRequests: sheet,
})

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

  // Tenant admin operation: preview a parsed 番薯 export (counts only, no writes).
  importFanshuPreview: adminProcedure
    .input(z.object({ sheets: fanshuSheets }))
    .mutation(({ ctx, input }) => previewFanshuImport(ctx.libraryId, input.sheets)),

  // Tenant admin operation: import a parsed 番薯 export into THIS library.
  // Idempotent (re-running updates rather than duplicates). Scoped to ctx.libraryId.
  importFanshu: adminProcedure
    .input(z.object({ sheets: fanshuSheets, fileName: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      new FanshuImportService(ctx.db).import(ctx.libraryId, input.sheets, {
        fileName: input.fileName,
        ranByUserId: ctx.user.id,
      }),
    ),

  // Same as above, but the Worker fetches + parses the .xls from a 番薯 export
  // URL (browser can't fetch it cross-origin). `preview: true` = counts only.
  importFanshuFromUrl: adminProcedure
    .input(z.object({ url: z.string().url(), preview: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const sheets = await fetchFanshuWorkbook(input.url)
      return input.preview
        ? previewFanshuImport(ctx.libraryId, sheets)
        : new FanshuImportService(ctx.db).import(ctx.libraryId, sheets, {
            sourceUrl: input.url,
            ranByUserId: ctx.user.id,
          })
    }),

  // Import audit history (newest first): source URL, R2 key, counts, who/when.
  importHistory: adminProcedure.query(({ ctx }) =>
    new FanshuImportService(ctx.db).listRuns(ctx.libraryId),
  ),
})
