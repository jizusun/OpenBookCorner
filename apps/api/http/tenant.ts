import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars } from '../lib/mw'
import { sessionAuth, superAdmin } from '../lib/mw'
import { TenantAdminService } from '../services'

const createBody = z.object({
  name: z.string().min(1).max(120),
  emailDomains: z.array(z.string().min(1)).min(1),
})

const setActiveBody = z.object({ libraryId: z.string().min(1), isActive: z.boolean() })

/** Super-admin only: cross-tenant library management (NOT tenant-scoped). */
export const tenantApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth, superAdmin)
  .get('/', (c) => c.json(new TenantAdminService(c.get('db')).listAll()))
  .post('/', zValidator('json', createBody), (c) =>
    c.json(new TenantAdminService(c.get('db')).create(c.req.valid('json'))),
  )
  .post('/set-active', zValidator('json', setActiveBody), (c) =>
    c.json(
      new TenantAdminService(c.get('db')).setActive(
        c.req.valid('json').libraryId,
        c.req.valid('json').isActive,
      ),
    ),
  )
