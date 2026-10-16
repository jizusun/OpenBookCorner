/**
 * App worker: serves the built SPA static assets and forwards /api/* to the
 * API worker over a service binding. Single public entrypoint on the custom
 * domain; the API worker stays internal (no public route needed).
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Forward API + auth traffic to the API worker (same-origin from the SPA).
    if (url.pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }

    // Everything else: static assets. SPA fallback (not_found_handling) serves
    // index.html for client-side routes.
    return env.ASSETS.fetch(request)
  },
}

interface Env {
  ASSETS: Fetcher
  API: Fetcher
}
