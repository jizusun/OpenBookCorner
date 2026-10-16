import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import app from './lib/app'
import { createAuth } from './lib/auth'
import type { AppContext } from './lib/context'
import { createDb } from './lib/db'
import { envSchema, type Env } from './lib/env'

type CloudflareEnv = {
  DB: D1Database
  APP_ORIGIN?: string
  APP_NAME?: string
  BETTER_AUTH_SECRET?: string
  ENVIRONMENT?: string
}

const worker = new Hono<{ Bindings: CloudflareEnv; Variables: AppContext['Variables'] }>()

worker.use(logger())

// Initialize per-request db + auth from bindings.
worker.use(async (c, next) => {
  const env: Env = {
    ...envSchema.parse({
      ENVIRONMENT: c.env.ENVIRONMENT ?? 'development',
      APP_NAME: c.env.APP_NAME ?? 'OpenBookCorner',
      APP_ORIGIN: c.env.APP_ORIGIN ?? 'http://localhost:5173',
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-me-32chars-min!!',
    }),
    DB: c.env.DB,
  }
  const db = createDb(c.env.DB)
  const auth = createAuth(db, env)
  c.set('db', db)
  c.set('auth', auth)
  // Make parsed env available to tRPC via c.env.
  Object.assign(c.env, env)
  await next()
})

// CORS so the SPA (served from its own worker in dev/prod) can call the API.
worker.use(
  '/api/*',
  cors({
    origin: (origin) => origin ?? '*',
    credentials: true,
  }),
)

worker.route('/', app)

export default worker
