import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import type { Auth } from './auth'
import type { Database } from '@obc/db'
import type { Env } from './env'
import { appRouter } from './router'

/** Everything the API handler needs for a request, built once per request. */
export type ApiDeps = {
  db: Database
  auth: Auth
  env: Env
}

/**
 * Framework-free API dispatcher. Handles the four backend concerns the app
 * Worker exposes — Better Auth, tRPC, health, and R2 cover images — using plain
 * URL checks instead of an HTTP framework (Hono). Returns a `Response` for a
 * matched API path, or `null` when the request is not an API request (so the
 * caller can fall through to the SPA static assets).
 *
 * This is deliberately a pure function of (request, deps): no global state, no
 * middleware stack. The caller (the Worker entry) builds `deps` from the
 * Cloudflare bindings and owns the SPA fallback.
 */
export async function handleApiRequest(req: Request, deps: ApiDeps): Promise<Response | null> {
  const url = new URL(req.url)
  const { pathname } = url

  // Health check.
  if (pathname === '/health') {
    return Response.json({ status: 'healthy', timestamp: new Date().toISOString() })
  }

  // Better Auth: sign-in / sign-up / sign-out / get-session, etc.
  if (pathname.startsWith('/api/auth/')) {
    return deps.auth.handler(req)
  }

  // tRPC.
  if (pathname.startsWith('/api/trpc')) {
    return fetchRequestHandler({
      req,
      router: appRouter,
      endpoint: '/api/trpc',
      async createContext({ req: ctxReq, resHeaders }) {
        const sessionData = await deps.auth.api.getSession({ headers: ctxReq.headers })
        return {
          req: ctxReq,
          resHeaders,
          env: deps.env,
          db: deps.db,
          session: sessionData?.session ?? null,
          user: (sessionData?.user ?? null) as never,
        }
      },
      batching: { enabled: true },
      onError({ error, path }) {
        console.error('tRPC error on path', path, ':', error.message)
      },
    })
  }

  // Stored cover images from R2 (same-origin, immutable long-cache). Keys are
  // content-addressed, so immutable caching is safe.
  if (pathname.startsWith('/covers/')) {
    const r2 = deps.env.COVERS
    const key = decodeURIComponent(pathname.slice('/covers/'.length))
    if (!r2 || !key) return new Response('Not found', { status: 404 })
    const obj = await r2.get(key)
    if (!obj) return new Response('Not found', { status: 404 })
    const headers = new Headers()
    headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/jpeg')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new Response(obj.body, { headers })
  }

  // Not an API request — let the caller serve the SPA.
  return null
}
