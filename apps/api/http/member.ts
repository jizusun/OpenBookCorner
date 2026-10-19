import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { MemberService } from '../services'

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: z.enum(['name', 'joinedAt', 'borrowedCount', 'memberExpiry']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  role: z.enum(['library_admin', 'library_reader']).optional(),
  plan: z.string().optional(),
})

/** Admin-only library members (番薯 成员). Tenant-scoped. */
export const memberApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant, admin)
  .get('/', zValidator('query', listQuery), async (c) =>
    c.json(await new MemberService(c.get('db')).listByLibrary(c.get('libraryId'), c.req.valid('query'))),
  )
  .get('/facets', async (c) => c.json(await new MemberService(c.get('db')).listFacets(c.get('libraryId'))))
  .get('/:memberId', async (c) => {
    const m = await new MemberService(c.get('db')).getById(c.req.param('memberId'), c.get('libraryId'))
    if (!m) return c.json({ error: 'MEMBER_NOT_FOUND' }, 404)
    return c.json(m)
  })
