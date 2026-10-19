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
  slug: z.string().min(2).max(40).optional(),
})

const updateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  emailDomains: z.array(z.string().min(1)).min(1).optional(),
  slug: z.string().min(2).max(40).optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z.string().max(32).nullable().optional(),
  loginWelcome: z.string().max(200).nullable().optional(),
})

const setActiveBody = z.object({ libraryId: z.string().min(1), isActive: z.boolean() })

/** Super-admin only: cross-tenant library management (NOT tenant-scoped). */
export const tenantApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth, superAdmin)
  .get('/', async (c) => c.json(await new TenantAdminService(c.get('db')).listAll()))
  // Super-admin system audit log (libraryId IS NULL): tenant.create/update/
  // delete/setActive. These have no tenant scope, so the tenant-scoped
  // /library/audit can never surface them (and a super admin has no libraryId).
  .get('/audit', async (c) => c.json(await new AuditService(c.get('db')).listSystem()))
  .post('/', zValidator('json', createBody), async (c) => {
    const created = await new TenantAdminService(c.get('db')).create(c.req.valid('json'))
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: null, // system-level op
      action: 'tenant.create',
      targetType: 'library',
      targetId: created.id,
      metadata: { slug: created.slug },
    })
    return c.json(created)
  })
  .patch('/:id', zValidator('json', updateBody), async (c) => {
    const id = c.req.param('id')
    const res = await new TenantAdminService(c.get('db')).update(id, c.req.valid('json'))
    if (!res.updated) {
      const status = res.error === 'LIBRARY_NOT_FOUND' ? 404 : 409
      return c.json({ error: res.error ?? 'UPDATE_FAILED' }, status)
    }
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: null,
      action: 'tenant.update',
      targetType: 'library',
      targetId: id,
      metadata: { fields: Object.keys(c.req.valid('json')) },
    })
    return c.json(res)
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')
    const res = await new TenantAdminService(c.get('db')).delete(id)
    if (!res.deleted) {
      const status = res.error === 'LIBRARY_NOT_FOUND' ? 404 : 409
      return c.json({ error: res.error ?? 'DELETE_FAILED' }, status)
    }
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: null,
      action: 'tenant.delete',
      targetType: 'library',
      targetId: id,
    })
    return c.json(res)
  })
  .post('/set-active', zValidator('json', setActiveBody), async (c) => {
    const res = await new TenantAdminService(c.get('db')).setActive(
      c.req.valid('json').libraryId,
      c.req.valid('json').isActive,
    )
    if (!res.updated) return c.json({ error: 'LIBRARY_NOT_FOUND' }, 404)
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
