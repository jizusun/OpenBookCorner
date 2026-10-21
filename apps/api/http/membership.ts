import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars } from '../lib/mw'
import { sessionAuth } from '../lib/mw'
import { MembershipService } from '../services/membership'
import { AuditService } from '../services/audit'

const createLibraryBody = z.object({
  name: z.string().min(1).max(120),
  emailDomains: z.array(z.string()).default([]),
})
const switchBody = z.object({ libraryId: z.string().min(1) })

/**
 * Membership + library-selection endpoints (ADR 0009). Guarded by `sessionAuth`
 * ONLY — NOT `tenant` — because a freshly-signed-up user has no active library
 * yet and must still be able to list/create/switch. All operations are scoped
 * to the authenticated user.
 */
export const membershipApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth)
  // The user's libraries (active memberships) + which one is active.
  .get('/mine', async (c) => {
    const svc = new MembershipService(c.get('db'))
    return c.json(await svc.listUserLibraries(c.get('user').id))
  })
  // Create a new library; the creator becomes its admin + it becomes active.
  .post('/create-library', zValidator('json', createLibraryBody), async (c) => {
    const svc = new MembershipService(c.get('db'))
    const res = await svc.createLibraryAsAdmin(c.get('user').id, c.req.valid('json'))
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: res.id,
      action: 'library.create',
      targetType: 'library',
      targetId: res.id,
    })
    return c.json(res)
  })
  // Switch the active library (must be an active member there).
  .post('/switch', zValidator('json', switchBody), async (c) => {
    const svc = new MembershipService(c.get('db'))
    const ok = await svc.switchActive(c.get('user').id, c.req.valid('json').libraryId)
    if (!ok) return c.json({ error: 'NOT_A_MEMBER' }, 403)
    return c.json({ success: true })
  })
