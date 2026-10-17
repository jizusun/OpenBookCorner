/**
 * Single full-stack Worker: serves the built SPA static assets AND runs the
 * Hono/tRPC + Better Auth backend in the same process (no service binding).
 *
 * Consolidating into one Worker means a Workers Builds *preview* of this Worker
 * runs the actual backend code too — so a PR that changes Hono/tRPC is reflected
 * in its preview URL (not just frontend changes).
 */
import { Hono } from 'hono'
import { logger } from 'hono/logger'

import { app as apiApp, createAuth, createDb, envSchema, type Env } from '@obc/api'

type CloudflareEnv = {
  ASSETS: Fetcher
  DB: D1Database
  COVERS: R2Bucket
  APP_ORIGIN?: string
  APP_NAME?: string
  BETTER_AUTH_SECRET?: string
  ENVIRONMENT?: string
}

type Vars = {
  db: ReturnType<typeof createDb>
  auth: ReturnType<typeof createAuth>
}

const worker = new Hono<{ Bindings: CloudflareEnv; Variables: Vars }>()

worker.use(logger())

// Initialize per-request db + auth from bindings (same as the former api worker).
worker.use('/api/*', async (c, next) => {
  const environment = c.env.ENVIRONMENT ?? 'development'
  // Fail closed in production: never sign sessions with a public fallback secret.
  // Fail closed on any internet-reachable deployment: production AND preview are
  // publicly reachable, so a missing BETTER_AUTH_SECRET must NOT silently fall
  // back to the public dev constant (that would let anyone forge session
  // cookies, including admin/super-admin). The dev fallback is ONLY for local
  // dev / E2E (development).
  const requiresRealSecret = environment === 'production' || environment === 'preview'
  if (requiresRealSecret && !c.env.BETTER_AUTH_SECRET) {
    return c.json({ error: 'Server misconfigured: BETTER_AUTH_SECRET is required' }, 500)
  }
  const env: Env = {
    ...envSchema.parse({
      ENVIRONMENT: environment,
      APP_NAME: c.env.APP_NAME ?? 'OpenBookCorner',
      APP_ORIGIN: c.env.APP_ORIGIN ?? 'http://localhost:5173',
      BETTER_AUTH_SECRET:
        c.env.BETTER_AUTH_SECRET ?? 'dev-only-insecure-secret-change-me-32chars',
    }),
    DB: c.env.DB,
    COVERS: c.env.COVERS,
  }
  const db = createDb(c.env.DB)
  c.set('db', db)
  c.set('auth', createAuth(db, env))
  Object.assign(c.env, env)
  await next()
})
// /covers/* also needs the bindings (served by the Hono app from R2).
worker.use('/covers/*', async (c, next) => {
  Object.assign(c.env, {
    ENVIRONMENT: c.env.ENVIRONMENT ?? 'production',
    APP_NAME: c.env.APP_NAME ?? 'OpenBookCorner',
    APP_ORIGIN: c.env.APP_ORIGIN ?? 'https://openbookcorner.jizu.dev',
  })
  await next()
})

// Backend routes (tRPC at /api/trpc, Better Auth at /api/auth/*, /covers/:key, /health).
worker.route('/', apiApp)

// Everything else → SPA assets (not_found_handling serves index.html for client routes).
worker.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default worker
