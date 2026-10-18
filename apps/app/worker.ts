/**
 * Single full-stack Worker (no HTTP framework).
 *
 * Serves the built SPA static assets AND runs the tRPC + Better Auth backend in
 * the same process. A plain `fetch` handler dispatches the four API concerns via
 * `handleApiRequest` (Better Auth, tRPC, /health, /covers) and falls through to
 * the SPA assets for everything else. There is no Hono, no CORS (same-origin
 * single Worker), and no service binding.
 */
import { createAuth, createDb, envSchema, handleApiRequest, type Env } from '@obc/api'

type CloudflareEnv = {
  ASSETS: Fetcher
  DB: D1Database
  COVERS: R2Bucket
  APP_ORIGIN?: string
  APP_NAME?: string
  BETTER_AUTH_SECRET?: string
  ENVIRONMENT?: string
}

/** Build the parsed, validated per-request Env from the raw Cloudflare bindings. */
function resolveEnv(cfEnv: CloudflareEnv, req: Request): Env {
  const environment = cfEnv.ENVIRONMENT ?? 'development'
  return {
    ...envSchema.parse({
      ENVIRONMENT: environment,
      APP_NAME: cfEnv.APP_NAME ?? 'OpenBookCorner',
      // Preview URLs are per-PR (pr-N.openbookcorner.jizu.dev), so a static
      // APP_ORIGIN can't match. Derive it from the incoming request in preview
      // (and dev) so Better Auth's baseURL + cookies match the host the browser
      // is actually on. Production uses the fixed configured origin.
      APP_ORIGIN:
        environment === 'production'
          ? (cfEnv.APP_ORIGIN ?? 'https://openbookcorner.jizu.dev')
          : new URL(req.url).origin,
      BETTER_AUTH_SECRET:
        cfEnv.BETTER_AUTH_SECRET ?? 'dev-only-insecure-secret-change-me-32chars',
    }),
    DB: cfEnv.DB,
    COVERS: cfEnv.COVERS,
  }
}

export default {
  async fetch(req: Request, cfEnv: CloudflareEnv): Promise<Response> {
    const url = new URL(req.url)
    const isApi =
      url.pathname === '/health' ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/covers/')

    if (isApi) {
      const environment = cfEnv.ENVIRONMENT ?? 'development'
      // Fail closed on any internet-reachable deployment: production AND preview
      // are publicly reachable, so a missing BETTER_AUTH_SECRET must NOT silently
      // fall back to the public dev constant (that would let anyone forge session
      // cookies, including admin/super-admin). The dev fallback is ONLY for local
      // dev / E2E (development).
      const requiresRealSecret = environment === 'production' || environment === 'preview'
      if (requiresRealSecret && !cfEnv.BETTER_AUTH_SECRET) {
        return Response.json(
          { error: 'Server misconfigured: BETTER_AUTH_SECRET is required' },
          { status: 500 },
        )
      }

      const env = resolveEnv(cfEnv, req)
      const db = createDb(cfEnv.DB)
      const auth = createAuth(db, env)

      const res = await handleApiRequest(req, { db, auth, env })
      if (res) return res
    }

    // Everything else → SPA assets (not_found_handling serves index.html for
    // client-side routes).
    return cfEnv.ASSETS.fetch(req)
  },
}
