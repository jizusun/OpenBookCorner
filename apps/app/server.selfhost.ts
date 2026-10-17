/**
 * Self-hosted entry point (Bun). Runs the SAME Hono app + tRPC routers + Better
 * Auth as the Cloudflare Worker, but with self-hostable primitives instead of
 * Workers bindings:
 *   - D1            → libsql/SQLite file (DB_PATH, default /data/obc.db)
 *   - static assets → served from ./dist by Bun
 *
 * Cover images are served from Cloudflare R2's public CDN (fast globally + in
 * China), NOT from this box — so the small VPS/SBC stores no images and the
 * `/covers/*` proxy route is unnecessary here. Stored cover URLs are absolute
 * R2 CDN URLs rendered directly by the SPA.
 *
 * The Cloudflare path (apps/app/worker.ts) is untouched — this is a parallel
 * entry selected at deploy time (Dockerfile runs this file with Bun).
 */
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { appRouter, createAuth, envSchema, type Env } from '@obc/api'
import { schema } from '@obc/db'

const DB_PATH = process.env.DB_PATH ?? '/data/obc.db'
const PORT = Number(process.env.PORT ?? 3000)

// --- DB: Bun's built-in SQLite (baked into the Bun runtime, so a
// `bun build --compile` single binary has no external native .node to miss) ---
const sqlite = new BunSqlite(DB_PATH, { create: true })
sqlite.exec('PRAGMA journal_mode = WAL;') // enables near-real-time Litestream backup
const db = drizzle(sqlite, { schema, casing: 'snake_case' }) as never

// libsql's Drizzle client has no D1-style `.batch([...])`; the import service
// uses it. Shim it to sequential execution (good enough for the import path).
const anyDb = db as unknown as { batch?: (stmts: Array<Promise<unknown>>) => Promise<unknown[]> }
if (!anyDb.batch) anyDb.batch = async (stmts) => Promise.all(stmts)

const env: Env = {
  ...envSchema.parse({
    ENVIRONMENT: process.env.ENVIRONMENT ?? 'production',
    APP_NAME: process.env.APP_NAME ?? 'OpenBookCorner',
    APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${PORT}`,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? '',
  }),
  DB: db as never,
  // Covers are served from the R2 public CDN, not this host — no R2 binding here.
  COVERS: undefined as never,
}

const auth = createAuth(db, env)
const app = new Hono()
app.use(logger())

app.get('/health', (c) =>
  c.json({ status: 'healthy', mode: 'self-hosted', ts: new Date().toISOString() }),
)

// Better Auth
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// tRPC
app.use('/api/trpc/*', (c) =>
  fetchRequestHandler({
    req: c.req.raw,
    router: appRouter,
    endpoint: '/api/trpc',
    async createContext({ req, resHeaders }) {
      const sessionData = await auth.api.getSession({ headers: req.headers })
      return {
        req,
        resHeaders,
        env,
        db,
        session: sessionData?.session ?? null,
        user: (sessionData?.user ?? null) as never,
      }
    },
    batching: { enabled: true },
  }),
)

// Static SPA assets + SPA fallback to index.html. In a `bun build --compile`
// binary, import.meta.dir is a virtual path, so the dist location is an env
// (DIST_DIR), defaulting to ./dist next to the binary/CWD.
const DIST = process.env.DIST_DIR ?? join(process.cwd(), 'dist')
app.get('*', (c) => {
  const url = new URL(c.req.url)
  const filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  const file = Bun.file(existsSync(filePath) ? filePath : join(DIST, 'index.html'))
  return new Response(file)
})

// eslint-disable-next-line no-console
console.log(`OpenBookCorner (self-hosted) on :${PORT} — db=${DB_PATH}, covers via R2 CDN`)
Bun.serve({ port: PORT, fetch: app.fetch, idleTimeout: 60 })
