import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { BookService } from '../services'
import { AuditService } from '../services/audit'
import { lookupBookMetadata } from '../services/bookMetadata'
import { storeCoverImage } from '../services/covers'

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: z.enum(['enteredAt', 'title', 'author', 'available', 'price']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  category: z.string().optional(),
  shelf: z.string().optional(),
  availability: z.enum(['all', 'available', 'borrowed']).optional(),
})

const addBody = z.object({
  isbn: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  publisher: z.string().optional(),
  publishedYear: z.number().int().optional(),
  coverImageUrl: z.string().url().optional(),
  description: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
})

const updateBody = z.object({
  bookId: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  isbn: z.string().min(1),
  publisher: z.string().optional(),
  publishedYear: z.number().int().optional(),
  description: z.string().optional(),
})

/**
 * Book catalog. Reads require a tenant member; writes require admin. Tenant
 * isolation: every call uses `c.get('libraryId')` from the session, never from
 * client input. Guards are attached at the sub-app level below.
 */
export const bookApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant)
  .get('/', zValidator('query', listQuery), async (c) =>
    c.json(await new BookService(c.get('db')).listByLibrary(c.get('libraryId'), c.req.valid('query'))),
  )
  .get('/facets', async (c) => c.json(await new BookService(c.get('db')).listFacets(c.get('libraryId'))))
  .get('/:bookId', async (c) =>
    c.json(await new BookService(c.get('db')).getById(c.req.param('bookId'), c.get('libraryId'))),
  )
  // Admin-only below.
  .get('/:bookId/borrower', admin, async (c) =>
    c.json(await new BookService(c.get('db')).getActiveBorrower(c.req.param('bookId'), c.get('libraryId'))),
  )
  .post('/', admin, zValidator('json', addBody), async (c) => {
    const input = c.req.valid('json')
    const env = c.get('env')
    let coverImageUrl = input.coverImageUrl
    if (coverImageUrl && env.COVERS) {
      const stored = await storeCoverImage(env.COVERS, coverImageUrl, input.isbn)
      if (stored) coverImageUrl = stored
    }
    const added = await new BookService(c.get('db')).add({
      ...input,
      coverImageUrl,
      libraryId: c.get('libraryId'),
    })
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: c.get('libraryId'),
      action: 'book.add',
      targetType: 'book',
      targetId: (added as { id?: string } | null)?.id ?? null,
      metadata: { isbn: input.isbn, quantity: input.quantity ?? 1 },
    })
    return c.json(added)
  })
  .patch('/:bookId', admin, zValidator('json', updateBody.omit({ bookId: true })), async (c) => {
    const fields = c.req.valid('json')
    const res = await new BookService(c.get('db')).update(c.req.param('bookId'), c.get('libraryId'), {
      ...fields,
      publisher: fields.publisher ?? null,
      publishedYear: fields.publishedYear ?? null,
      description: fields.description ?? null,
    })
    if (!res.updated) return c.json({ error: 'BOOK_NOT_FOUND' }, 404)
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: c.get('libraryId'),
      action: 'book.update',
      targetType: 'book',
      targetId: c.req.param('bookId'),
    })
    return c.json(res)
  })
  .delete('/:bookId', admin, async (c) => {
    const res = await new BookService(c.get('db')).delete(c.req.param('bookId'), c.get('libraryId'))
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: c.get('libraryId'),
      action: 'book.delete',
      targetType: 'book',
      targetId: c.req.param('bookId'),
    })
    return c.json(res)
  })
  .get('/lookup/:isbn', admin, async (c) => c.json(await lookupBookMetadata(c.req.param('isbn'))))
