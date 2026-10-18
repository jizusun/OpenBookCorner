import { Hono } from 'hono'

import type { BaseVars } from '../lib/mw'
import { apiApp } from './app'

/**
 * The full backend mounted by the Worker. Expects the Worker to have set
 * `db`, `auth`, and `env` on the context (BaseVars) before this runs.
 *
 * - /health              — liveness
 * - /api/auth/*          — Better Auth (sign-in/up/out/session)
 * - /api/*               — the typed hc API (apiApp): book/borrowing/library/…
 * - /covers/:key         — R2 cover images (same-origin, immutable cache)
 */
export const serverApp = new Hono<{ Variables: BaseVars }>()
  .get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }))
  .on(['GET', 'POST'], '/api/auth/*', (c) => c.get('auth').handler(c.req.raw))
  .route('/api', apiApp)
  .get('/covers/:key', async (c) => {
    const r2 = c.get('env').COVERS
    if (!r2) return c.notFound()
    const obj = await r2.get(c.req.param('key'))
    if (!obj) return c.notFound()
    const headers = new Headers()
    headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/jpeg')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(obj.body, { headers })
  })

export type ServerApp = typeof serverApp
