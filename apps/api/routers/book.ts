import { z } from 'zod'

import { adminProcedure, router, tenantProcedure } from '../lib/trpc'
import { mapDomainErrors, DomainError } from '../lib/errors'
import { BookService } from '../services'
import { lookupBookMetadata } from '../services/bookMetadata'

export const bookRouter = router({
  list: tenantProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(200).optional(),
          sortBy: z.enum(['enteredAt', 'title', 'author', 'available', 'price']).optional(),
          sortDir: z.enum(['asc', 'desc']).optional(),
          category: z.string().optional(),
          shelf: z.string().optional(),
          availability: z.enum(['all', 'available', 'borrowed']).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => new BookService(ctx.db).listByLibrary(ctx.libraryId, input ?? {})),

  // Distinct categories + shelves for the catalog's filter dropdowns.
  facets: tenantProcedure.query(({ ctx }) => new BookService(ctx.db).listFacets(ctx.libraryId)),

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
    .mutation(({ ctx, input }) =>
      // Cover persistence (R2) is orchestrated inside the service so the
      // transport layer only validates + delegates.
      new BookService(ctx.db).add({ ...input, libraryId: ctx.libraryId, covers: ctx.env.COVERS }),
    ),

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
    .mutation(({ ctx, input }) =>
      mapDomainErrors(async () => {
        const { bookId, ...fields } = input
        const res = await new BookService(ctx.db).update(bookId, ctx.libraryId, {
          ...fields,
          publisher: fields.publisher ?? null,
          publishedYear: fields.publishedYear ?? null,
          description: fields.description ?? null,
        })
        if (!res.updated) throw new DomainError('BOOK_NOT_FOUND')
        return res
      }),
    ),

  remove: adminProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      mapDomainErrors(() => new BookService(ctx.db).delete(input.bookId, ctx.libraryId)),
    ),

  // Admin-only ISBN metadata lookup (Open Library + Google Books). Returns null
  // when not found so the UI can fall back to manual entry.
  lookupIsbn: adminProcedure
    .input(z.object({ isbn: z.string().min(1) }))
    .query(({ input }) => lookupBookMetadata(input.isbn)),
})
