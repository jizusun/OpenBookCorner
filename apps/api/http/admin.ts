import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { AuthedVars } from '../lib/mw'
import { sessionAuth, superAdmin } from '../lib/mw'
import { UserAdminService } from '../services/user-admin'
import { OverviewService } from '../services/overview'
import { AuditService } from '../services/audit'

const listQuery = z.object({
  search: z.string().optional(),
  libraryId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  libraryId: z.string().optional(),
  action: z.string().optional(),
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
  .get('/audit', zValidator('query', auditQuery), async (c) =>
    c.json(await new AuditService(c.get('db')).listAll(c.req.valid('query'))),
  )
