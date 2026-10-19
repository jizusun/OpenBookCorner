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

describe('public endpoint rate limiting (ADR 0003)', () => {
  it('returns 429 when the rate limiter rejects', async () => {
    const app = createTestServer({
      db,
      session: null,
      rateLimiter: { limit: async () => ({ success: false }) },
    })
    const res = await app.request('https://openbookcorner.jizu.dev/api/public/config')
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'RATE_LIMITED' })
  })

  it('passes through when the limiter allows (and when no limiter is bound)', async () => {
    const ok = createTestServer({
      db,
      session: null,
      rateLimiter: { limit: async () => ({ success: true }) },
    })
    expect((await ok.request('https://openbookcorner.jizu.dev/api/public/config')).status).toBe(200)
    // No limiter bound (local/dev) → never blocks.
    const none = createTestServer({ db, session: null })
    expect((await none.request('https://openbookcorner.jizu.dev/api/public/config')).status).toBe(
      200,
    )
  })
})
