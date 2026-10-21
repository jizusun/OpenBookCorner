import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars, TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { JoinRequestService } from '../services/join-request'

const submitBody = z.object({
  libraryId: z.string().min(1),
  answers: z.record(z.string()).optional(),
})
const decideBody = z.object({ requestId: z.string().min(1) })

// User-facing (sessionAuth only — no active library needed for discover/request).
const userApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth)
  .get('/discover', async (c) => {
    return c.json(await new JoinRequestService(c.get('db')).discoverPublic(c.get('user').id))
  })
  .post('/request', zValidator('json', submitBody), async (c) => {
    const { libraryId, answers } = c.req.valid('json')
    const res = await new JoinRequestService(c.get('db')).submit(
      c.get('user').id,
      libraryId,
      'button',
      answers,
    )
    if ('error' in res) return c.json(res, 409)
    return c.json(res)
  })
  .delete('/request/:id', async (c) => {
    return c.json(
      await new JoinRequestService(c.get('db')).cancel(c.req.param('id'), c.get('user').id),
    )
  })

// Admin-facing (tenant + admin guards).
const adminApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant, admin)
  .get('/admin/requests', async (c) =>
    c.json(await new JoinRequestService(c.get('db')).listPending(c.get('libraryId'))),
  )
  .post('/admin/approve', zValidator('json', decideBody), async (c) => {
    const res = await new JoinRequestService(c.get('db')).approve(
      c.req.valid('json').requestId,
      c.get('user').id,
    )
    if ('error' in res) return c.json(res, 404)
    return c.json(res)
  })
  .post('/admin/reject', zValidator('json', decideBody), async (c) => {
    const res = await new JoinRequestService(c.get('db')).reject(
      c.req.valid('json').requestId,
      c.get('user').id,
    )
    if ('error' in res) return c.json(res, 404)
    return c.json(res)
  })

/**
 * Join-request endpoints (ADR 0009 step 4). Discover + submit are user-facing
 * (sessionAuth only, so a user with no active library can still request to join).
 * Admin list/approve/reject require tenant + admin guards.
 */
export const joinRequestApp = new Hono()
  .route('/', userApp)
  .route('/', adminApp)
