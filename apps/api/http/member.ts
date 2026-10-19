import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { TenantVars } from '../lib/mw'
import { admin, sessionAuth, tenant } from '../lib/mw'
import { MemberService } from '../services'
import { createTenantUser, type CreateAccount } from '../services/onboard'

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: z.enum(['name', 'joinedAt', 'borrowedCount', 'memberExpiry']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  role: z.enum(['library_admin', 'library_reader']).optional(),
  plan: z.string().optional(),
})

const createMemberBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
})

/** Admin-only library members (番薯 成员). Tenant-scoped. */
export const memberApp = new Hono<{ Variables: TenantVars }>()
  .use(sessionAuth, tenant, admin)
  .get('/', zValidator('query', listQuery), async (c) =>
    c.json(await new MemberService(c.get('db')).listByLibrary(c.get('libraryId'), c.req.valid('query'))),
  )
  .get('/facets', async (c) => c.json(await new MemberService(c.get('db')).listFacets(c.get('libraryId'))))
  .post('/', zValidator('json', createMemberBody), async (c) => {
    const body = c.req.valid('json')
    const createAccount: CreateAccount = async (input) => {
      const createUserApi = (c.get('auth').api as unknown as {
        createUser: (o: { body: { email: string; name: string; password: string } }) => Promise<{ user: { id: string } }>
      }).createUser
      const res = await createUserApi({
        body: { email: input.email, name: input.name, password: input.password },
      })
      return { userId: (res as { user: { id: string } }).user.id }
    }
    const result = await createTenantUser(c.get('db'), createAccount, {
      libraryId: c.get('libraryId'), // session tenant — admins only add to THEIR library
      email: body.email,
      name: body.name,
      password: body.password,
      role: 'library_reader',
      actorUserId: c.get('user').id,
    })
    if (result.error) {
      return c.json({ error: result.error }, result.error === 'EMAIL_TAKEN' ? 409 : 400)
    }
    return c.json({ id: result.userId }, 201)
  })
  .get('/:memberId', async (c) => {
    const m = await new MemberService(c.get('db')).getById(c.req.param('memberId'), c.get('libraryId'))
    if (!m) return c.json({ error: 'MEMBER_NOT_FOUND' }, 404)
    return c.json(m)
  })
