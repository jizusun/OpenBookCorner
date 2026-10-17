/**
 * Self-hosted entry point (Bun). Runs the SAME Hono app + tRPC routers + Better
 * Auth as the Cloudflare Worker, but with self-hostable primitives instead of
 * Workers bindings:
 *   - D1            → libsql/SQLite file (DB_PATH, default /data/obc.db)
 *   - R2 (covers)   → local filesystem directory (COVERS_DIR, default /data/covers)
 *   - static assets → served from ./dist by Bun
 *
 * The Cloudflare path (apps/app/worker.ts) is untouched — this is a parallel
 * entry selected at deploy time (Dockerfile runs this file with Bun).
 */
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'

import { appRouter, createAuth, envSchema, type Env } from '@obc/api'
import { schema } from '@obc/db'

const DB_PATH = process.env.DB_PATH ?? '/data/obc.db'
const COVERS_DIR = process.env.COVERS_DIR ?? '/data/covers'
const PORT = Number(process.env.PORT ?? 3000)

// --- DB: libsql SQLite file, same Drizzle schema as D1 ---
const client = createClient({ url: `file:${DB_PATH}` })
const db = drizzle(client, { schema, casing: 'snake_case' }) as never

// libsql's Drizzle client has no D1-style `.batch([...])`; the import service
// uses it. Shim it to sequential execution (good enough for the import path).
const anyDb = db as unknown as { batch?: (stmts: Array<Promise<unknown>>) => Promise<unknown[]> }
if (!anyDb.batch) anyDb.batch = async (stmts) => Promise.all(stmts)

const CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
}

const env: Env = {
  ...envSchema.parse({
    ENVIRONMENT: process.env.ENVIRONMENT ?? 'production',
    APP_NAME: process.env.APP_NAME ?? 'OpenBookCorner',
    APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${PORT}`,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? '',
  }),
  // Covers/R2 is replaced by local FS below; DB is the libsql client. These
  // bindings aren't used on the self-host path (cast to satisfy the type).
  DB: db as never,
  COVERS: undefined as never,
}

const auth = createAuth(db, env)
const app = new Hono()
app.use(logger())

app.get('/health', (c) => c.json({ status: 'healthy', mode: 'self-hosted', ts: new Date().toISOString() }))

// Covers from local disk (replaces R2 /covers/:key).
app.get('/covers/:key', async (c) => {
  const key = c.req.param('key')
  if (key.includes('/') || key.includes('..')) return c.notFound()
  const path = join(COVERS_DIR, key)
  if (!existsSync(path)) return c.notFound()
  const body = await readFile(path)
  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPE[extname(key).toLowerCase()] ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

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

// Static SPA assets + SPA fallback to index.html.
const DIST = join(import.meta.dir, 'dist')
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname)
  const file = Bun.file(existsSync(filePath) ? filePath : join(DIST, 'index.html'))
  return new Response(file)
})

async function main() {
  await mkdir(COVERS_DIR, { recursive: true })
  // eslint-disable-next-line no-console
  console.log(`OpenBookCorner (self-hosted) on :${PORT} — db=${DB_PATH} covers=${COVERS_DIR}`)
  Bun.serve({ port: PORT, fetch: app.fetch, idleTimeout: 60 })
}

void main()
