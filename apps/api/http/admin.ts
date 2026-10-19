import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { AuthedVars } from '../lib/mw'
import { sessionAuth, superAdmin } from '../lib/mw'
import { UserAdminService } from '../services/user-admin'
import { OverviewService } from '../services/overview'

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

/**
 * Super-admin system endpoints that are explicitly NOT tenant-scoped
 * (cross-tenant reads for the super-admin console). Guarded by sessionAuth +
 * superAdmin, mounted at /api/admin.
 */
export const adminApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth, superAdmin)
  .get('/users', zValidator('query', listQuery), async (c) =>
    c.json(await new UserAdminService(c.get('db')).listAll(c.req.valid('query'))),
  )
  .get('/overview', async (c) => c.json(await new OverviewService(c.get('db')).get()))
