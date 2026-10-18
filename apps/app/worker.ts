/**
 * Single full-stack Worker: serves the built SPA static assets AND runs the
 * Hono API (hc) + Better Auth backend in the same process (no service binding).
 */
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'

import { type BaseVars, createAuth, createDb, envSchema, type Env, serverApp } from '@obc/api'

type CloudflareEnv = {
  ASSETS: Fetcher
  DB: D1Database
  COVERS: R2Bucket
  APP_ORIGIN?: string
  APP_NAME?: string
  BETTER_AUTH_SECRET?: string
  ENVIRONMENT?: string
}

const worker = new Hono<{ Bindings: CloudflareEnv; Variables: BaseVars }>()

worker.use(logger())

/** Build per-request db + auth + env from the Cloudflare bindings. */
const setup = createMiddleware<{ Bindings: CloudflareEnv; Variables: BaseVars }>(
  async (c, next) => {
    const environment = c.env.ENVIRONMENT ?? 'development'
    // Fail closed on any internet-reachable deployment: production AND preview
    // are publicly reachable, so a missing BETTER_AUTH_SECRET must NOT silently
    // fall back to the public dev constant (that would let anyone forge session
    // cookies, incl. admin/super-admin). The dev fallback is ONLY for local
    // dev / E2E (development).
    const requiresRealSecret = environment === 'production' || environment === 'preview'
    if (requiresRealSecret && !c.env.BETTER_AUTH_SECRET) {
      return c.json({ error: 'Server misconfigured: BETTER_AUTH_SECRET is required' }, 500)
    }
    const env: Env = {
      ...envSchema.parse({
        ENVIRONMENT: environment,
        APP_NAME: c.env.APP_NAME ?? 'OpenBookCorner',
        // Preview URLs are per-PR, so a static APP_ORIGIN can't match. Derive it
        // from the incoming request in preview/dev so Better Auth's baseURL +
        // cookies match the browser host. Production uses the configured origin.
        APP_ORIGIN:
          environment === 'production'
            ? (c.env.APP_ORIGIN ?? 'https://openbookcorner.jizu.dev')
            : new URL(c.req.url).origin,
        BETTER_AUTH_SECRET:
          c.env.BETTER_AUTH_SECRET ?? 'dev-only-insecure-secret-change-me-32chars',
      }),
      DB: c.env.DB,
      COVERS: c.env.COVERS,
    }
    const db = createDb(c.env.DB)
    c.set('db', db)
    c.set('auth', createAuth(db, env))
    c.set('env', env)
    await next()
  },
)

worker.use('/api/*', setup)
worker.use('/health', setup)
worker.use('/covers/*', setup)

// Backend: hc API under /api, Better Auth /api/auth/*, /covers/:key, /health.
worker.route('/', serverApp)

// Everything else → SPA assets (not_found_handling serves index.html).
worker.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default worker
