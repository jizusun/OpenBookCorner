import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars } from '../lib/mw'
import { sessionAuth, superAdmin } from '../lib/mw'
import { TenantAdminService } from '../services'
import { AuditService } from '../services/audit'

const createBody = z.object({
  name: z.string().min(1).max(120),
  emailDomains: z.array(z.string().min(1)).min(1),
})

const setActiveBody = z.object({ libraryId: z.string().min(1), isActive: z.boolean() })

/** Super-admin only: cross-tenant library management (NOT tenant-scoped). */
export const tenantApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth, superAdmin)
  .get('/', async (c) => c.json(await new TenantAdminService(c.get('db')).listAll()))
  .post('/', zValidator('json', createBody), async (c) => {
    const created = await new TenantAdminService(c.get('db')).create(c.req.valid('json'))
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: null, // system-level op
      action: 'tenant.create',
      targetType: 'library',
      targetId: (created as { id?: string } | null)?.id ?? null,
      metadata: { name: c.req.valid('json').name },
    })
    return c.json(created)
  })
  .post('/set-active', zValidator('json', setActiveBody), async (c) => {
    const res = await new TenantAdminService(c.get('db')).setActive(
      c.req.valid('json').libraryId,
      c.req.valid('json').isActive,
    )
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: null,
      action: 'tenant.setActive',
      targetType: 'library',
      targetId: c.req.valid('json').libraryId,
      metadata: { isActive: c.req.valid('json').isActive },
    })
    return c.json(res)
  })
