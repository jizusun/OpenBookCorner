import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars, TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { JoinRequestService } from '../services/join-request'
import { JoinFieldService } from '../services/join-field'
import { MembershipService, validateJoinAnswers } from '../services/membership'

const submitBody = z.object({
  libraryId: z.string().min(1),
  answers: z.record(z.string()).optional(),
  // verifiedEmails intentionally omitted — client-provided email ownership
  // claims are untrusted. Server-side OTP verification is Phase 2.
})
const decideBody = z.object({ requestId: z.string().min(1) })
const fieldBody = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  type: z.enum(['text', 'email', 'select']),
  required: z.boolean().optional(),
  verifyEmail: z.boolean().optional(),
  options: z.array(z.string()).optional(),
})
const fieldPatch = z.object({
  label: z.string().min(1).max(120).optional(),
  required: z.boolean().optional(),
  verifyEmail: z.boolean().optional(),
  options: z.array(z.string()).optional(),
})

// User-facing (sessionAuth only — no active library needed for discover/request).
const userApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth)
  .get('/discover', async (c) => {
    return c.json(await new JoinRequestService(c.get('db')).discoverPublic(c.get('user').id))
  })
  .get('/fields/:libraryId', async (c) =>
    c.json(await new JoinFieldService(c.get('db')).list(c.req.param('libraryId'))),
  )
  .post('/request', zValidator('json', submitBody), async (c) => {
    const { libraryId, answers } = c.req.valid('json')
    const svc = new JoinRequestService(c.get('db'))
    const fields = await new MembershipService(c.get('db')).joinFields(libraryId)
    if (fields.length > 0) {
      const errors = validateJoinAnswers(fields, answers ?? {}, []) // verifiedEmails: [] — OTP Phase 2
      if (errors.length > 0) return c.json({ error: 'VALIDATION_FAILED', fields: errors }, 422)
    }
    const res = await svc.submit(c.get('user').id, libraryId, 'button', answers)
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
      c.get('libraryId'), // scoped to admin's library (prevents cross-tenant approval)
    )
    if ('error' in res) return c.json(res, 404)
    return c.json(res)
  })
  .post('/admin/reject', zValidator('json', decideBody), async (c) => {
    const res = await new JoinRequestService(c.get('db')).reject(
      c.req.valid('json').requestId,
      c.get('user').id,
      c.get('libraryId'), // scoped to admin's library (prevents cross-tenant rejection)
    )
    if ('error' in res) return c.json(res, 404)
    return c.json(res)
  })
  // --- join form field management ---
  .get('/admin/fields', async (c) =>
    c.json(await new JoinFieldService(c.get('db')).list(c.get('libraryId'))),
  )
  .post('/admin/fields', zValidator('json', fieldBody), async (c) =>
    c.json(await new JoinFieldService(c.get('db')).create(c.get('libraryId'), c.req.valid('json'))),
  )
  .patch('/admin/fields/:id', zValidator('json', fieldPatch), async (c) => {
    await new JoinFieldService(c.get('db')).update(c.req.param('id'), c.get('libraryId'), c.req.valid('json'))
    return c.json({ success: true })
  })
  .delete('/admin/fields/:id', async (c) => {
    await new JoinFieldService(c.get('db')).remove(c.req.param('id'), c.get('libraryId'))
    return c.json({ success: true })
  })

/**
 * Join-request endpoints (ADR 0009 step 4). Discover + submit are user-facing
 * (sessionAuth only, so a user with no active library can still request to join).
 * Admin list/approve/reject require tenant + admin guards.
 */
export const joinRequestApp = new Hono()
  .route('/', userApp)
  .route('/', adminApp)
