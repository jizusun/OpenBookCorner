import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { CirculationService } from '../services'

const overdueQuery = z.object({ range: z.enum(['1-7', '8-14', '15+', 'all']).optional() })

/** Borrowing / circulation. Tenant-scoped; overdue listing is admin-only. */
export const borrowingApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant)
  .post('/borrow', zValidator('json', z.object({ bookId: z.string().min(1) })), async (c) =>
    c.json(
      await new CirculationService(c.get('db')).borrow(
        c.req.valid('json').bookId,
        c.get('user').id,
        c.get('libraryId'),
      ),
    ),
  )
  .post('/borrow-by-isbn', zValidator('json', z.object({ isbn: z.string().min(1) })), async (c) =>
    c.json(
      await new CirculationService(c.get('db')).borrowByIsbn(
        c.req.valid('json').isbn,
        c.get('user').id,
        c.get('libraryId'),
      ),
    ),
  )
  .post('/return', zValidator('json', z.object({ transactionId: z.string().min(1) })), async (c) =>
    c.json(
      await new CirculationService(c.get('db')).returnBook(
        c.req.valid('json').transactionId,
        c.get('user').id,
        c.get('libraryId'),
      ),
    ),
  )
  .get('/my-books', async (c) =>
    c.json(await new CirculationService(c.get('db')).myBooks(c.get('user').id, c.get('libraryId'))),
  )
  .get('/overdue', admin, zValidator('query', overdueQuery), async (c) =>
    c.json(
      await new CirculationService(c.get('db')).listOverdue(
        c.get('libraryId'),
        c.req.valid('query').range ?? 'all',
      ),
    ),
  )
