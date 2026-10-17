import { z } from 'zod'
import { TRPCError } from '@trpc/server'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { BookService } from '../services'
import { lookupBookMetadata } from '../services/bookMetadata'
import { storeCoverImage } from '../services/covers'

export const bookRouter = router({
  list: tenantProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => new BookService(ctx.db).listByLibrary(ctx.libraryId, input ?? {})),

  get: tenantProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .query(({ ctx, input }) => new BookService(ctx.db).getById(input.bookId, ctx.libraryId)),

  borrower: adminProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .query(({ ctx, input }) => new BookService(ctx.db).getActiveBorrower(input.bookId, ctx.libraryId)),

  add: adminProcedure
    .input(
      z.object({
        isbn: z.string().min(1),
        title: z.string().min(1),
        author: z.string().min(1),
        publisher: z.string().optional(),
        publishedYear: z.number().int().optional(),
        coverImageUrl: z.string().url().optional(),
        description: z.string().optional(),
        subjects: z.array(z.string()).optional(),
        quantity: z.number().int().min(1).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // If a cover URL is present, persist the image to R2 and store our own
      // same-origin path; fall back to the external URL if storage fails.
      let coverImageUrl = input.coverImageUrl
      if (coverImageUrl && ctx.env.COVERS) {
        const stored = await storeCoverImage(ctx.env.COVERS, coverImageUrl, input.isbn)
        if (stored) coverImageUrl = stored
      }
      return new BookService(ctx.db).add({ ...input, coverImageUrl, libraryId: ctx.libraryId })
    }),

  update: adminProcedure
    .input(
      z.object({
        bookId: z.string().min(1),
        title: z.string().min(1),
        author: z.string().min(1),
        isbn: z.string().min(1),
        publisher: z.string().optional(),
        publishedYear: z.number().int().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { bookId, ...fields } = input
      const res = await new BookService(ctx.db).update(bookId, ctx.libraryId, {
        ...fields,
        publisher: fields.publisher ?? null,
        publishedYear: fields.publishedYear ?? null,
        description: fields.description ?? null,
      })
      if (!res.updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'BOOK_NOT_FOUND' })
      return res
    }),

  remove: adminProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .mutation(({ ctx, input }) => new BookService(ctx.db).delete(input.bookId, ctx.libraryId)),

  // Admin-only ISBN metadata lookup (Open Library + Google Books). Returns null
  // when not found so the UI can fall back to manual entry.
  lookupIsbn: adminProcedure
    .input(z.object({ isbn: z.string().min(1) }))
    .query(({ input }) => lookupBookMetadata(input.isbn)),
})
