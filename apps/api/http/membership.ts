import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AuthedVars, TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { MembershipService } from '../services/membership'
import { AuditService } from '../services/audit'

const createLibraryBody = z.object({
  name: z.string().min(1).max(120),
  emailDomains: z.array(z.string()).default([]),
})
const switchBody = z.object({ libraryId: z.string().min(1) })
const removeBody = z.object({ userId: z.string().min(1) })

// ── User-facing (sessionAuth only — works even with no active library) ────────
const userApp = new Hono<{ Variables: AuthedVars }>()
  .use(sessionAuth)
  .get('/mine', async (c) =>
    c.json(await new MembershipService(c.get('db')).listUserLibraries(c.get('user').id)),
  )
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
  .post('/switch', zValidator('json', switchBody), async (c) => {
    const svc = new MembershipService(c.get('db'))
    const ok = await svc.switchActive(c.get('user').id, c.req.valid('json').libraryId)
    if (!ok) return c.json({ error: 'NOT_A_MEMBER' }, 403)
    return c.json({ success: true })
  })
  // Leave a library (self-service). Clears active_library_id if needed.
  .post('/leave', zValidator('json', switchBody), async (c) => {
    const svc = new MembershipService(c.get('db'))
    const ok = await svc.leaveLibrary(c.get('user').id, c.req.valid('json').libraryId)
    if (!ok) return c.json({ error: 'NOT_A_MEMBER' }, 403)
    return c.json({ success: true })
  })

// ── Admin-facing (tenant + admin guards) ──────────────────────────────────────
const adminApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant, admin)
  // List users who have an active membership in this library (the "Users" page).
  .get('/users', async (c) =>
    c.json(await new MembershipService(c.get('db')).listByLibrary(c.get('libraryId'))),
  )
  // Admin removes a user from this library.
  .post('/remove', zValidator('json', removeBody), async (c) => {
    const { userId } = c.req.valid('json')
    const svc = new MembershipService(c.get('db'))
    const ok = await svc.removeFromLibrary(userId, c.get('libraryId'))
    if (!ok) return c.json({ error: 'NOT_A_MEMBER' }, 404)
    await new AuditService(c.get('db')).log({
      actorUserId: c.get('user').id,
      libraryId: c.get('libraryId'),
      action: 'membership.remove',
      targetType: 'user',
      targetId: userId,
    })
    return c.json({ success: true })
  })

/**
 * Membership + library-selection endpoints (ADR 0009). Guarded by `sessionAuth`
 * ONLY on the user-facing routes — because a freshly-signed-up user has no
 * active library yet. Admin routes require tenant + admin.
 */
export const membershipApp = new Hono()
  .route('/', userApp)
  .route('/admin', adminApp)
