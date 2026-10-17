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
  const env: Env = {
    ...envSchema.parse({
      ENVIRONMENT: c.env.ENVIRONMENT ?? 'development',
      APP_NAME: c.env.APP_NAME ?? 'OpenBookCorner',
      APP_ORIGIN: c.env.APP_ORIGIN ?? 'http://localhost:5173',
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-32chars-min!!',
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
