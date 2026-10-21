import { Hono } from 'hono'

import { publicRateLimit } from '../lib/mw'
import type { BaseVars } from '../lib/mw'
import { TenantBrandingService } from '../services/branding'
import { apiApp } from './app'

/**
 * The full backend mounted by the Worker. Expects the Worker to have set
 * `db`, `auth`, and `env` on the context (BaseVars) before this runs.
 *
 * - /health                 — liveness
 * - /api/public/branding    — UNAUTHENTICATED tenant login branding (safe fields)
 * - /api/auth/*             — Better Auth (sign-in/up/out/session)
 * - /api/*                  — the typed hc API (apiApp): book/borrowing/library/…
 * - /covers/:key            — R2 cover images (same-origin, immutable cache)
 */
export const serverApp = new Hono<{ Variables: BaseVars }>()
  .get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }))
  // Rate-limit all unauthenticated public endpoints (branding + config).
  .use('/api/public/*', publicRateLimit)
  // Public, pre-auth branding for the tenant login page. Path-based tenancy:
  // the client reads the slug from the `/t/:slug` path and passes it as ?slug=.
  // Returns null (200) for a missing/invalid/unknown slug so the client shows
  // the standard login. Safe fields only (TenantBrandingService); no sensitive
  // data. This is the ONLY place the slug is used server-side — it is NOT an
  // auth boundary (isolation is the session `libraryId`).
  .get('/api/public/branding', async (c) => {
    // The `/t/<key>` segment may be a stable library id (permanent link) or a
    // human-readable slug (mutable alias). Accept either (ADR 0009). `?slug=`
    // is kept as an alias for the param for backward compatibility.
    const key = c.req.query('key') ?? c.req.query('slug')
    if (!key) return c.json(null)
    const branding = await new TenantBrandingService(c.get('db')).getByIdOrSlug(key)
    return c.json(branding)
  })
  // Public, non-secret runtime config for the SPA. Exposes ONLY the environment
  // name so the client can gate non-production affordances (e.g. the click-to-
  // fill demo accounts, which must NEVER show in production).
  .get('/api/public/config', (c) => c.json({ environment: c.get('env').ENVIRONMENT }))
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
