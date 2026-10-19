/**
 * Integration test for the public, unauthenticated endpoints that the SPA uses
 * pre-auth: /api/public/config (environment, for gating non-prod affordances).
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createTestServer } from './testHarness'
import { createTestDb } from '@obc/db/testing'
import type { Database } from '@obc/db'

let db: Database

beforeEach(async () => {
  db = await createTestDb()
})

describe('GET /api/public/config', () => {
  it('returns the environment and requires no auth', async () => {
    const app = createTestServer({ db, session: null, environment: 'preview' })
    const res = await app.request('https://openbookcorner.jizu.dev/api/public/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ environment: 'preview' })
  })

  it('reports production when configured so (used to HIDE demo affordances)', async () => {
    const app = createTestServer({ db, session: null, environment: 'production' })
    const res = await app.request('https://openbookcorner.jizu.dev/api/public/config')
    expect(await res.json()).toEqual({ environment: 'production' })
  })
})
