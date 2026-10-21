import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars, BaseVars, TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { InviteService } from '../services/invite'

const createBody = z.object({
  role: z.enum(['library_admin', 'library_reader']).optional(),
  requiresApproval: z.boolean().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresInDays: z.number().int().positive().optional(),
})
const useBody = z.object({
  token: z.string().min(1),
  answers: z.record(z.string()).optional(),
})

// Public: resolve a token (pre-auth preview on the landing page).
const publicApp = new Hono<{ Variables: BaseVars }>()
  .get('/resolve/:token', async (c) => {
    const svc = new InviteService(c.get('db'))
    const res = await svc.resolve(c.req.param('token'))
    if (!res) return c.json({ error: 'INVITE_INVALID' }, 404)
    return c.json(res)
  })

// User: use an invite (authenticated, no active library required).
const userApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth)
  .post('/use', zValidator('json', useBody), async (c) => {
    const { token, answers } = c.req.valid('json')
    const svc = new InviteService(c.get('db'))
    const res = await svc.use(token, c.get('user').id, answers)
    if ('error' in res) return c.json(res, 409)
    return c.json(res)
  })

// Admin: manage invites.
const adminApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant, admin)
  .get('/', async (c) =>
    c.json(await new InviteService(c.get('db')).list(c.get('libraryId'))),
  )
  .post('/', zValidator('json', createBody), async (c) => {
    const res = await new InviteService(c.get('db')).create(
      c.get('libraryId'),
      c.get('user').id,
      c.req.valid('json'),
    )
    return c.json(res)
  })
  .delete('/:id', async (c) => {
    await new InviteService(c.get('db')).revoke(c.req.param('id'), c.get('libraryId'))
    return c.json({ success: true })
  })

export const inviteApp = new Hono()
  .route('/invites', publicApp)
  .route('/invites', userApp)
  .route('/admin/invites', adminApp)
