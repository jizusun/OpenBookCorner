import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'

import type { AppContext } from './context'
import { router } from './trpc'
import { authRouter } from '../routers/auth'
import { bookRouter } from '../routers/book'
import { borrowingRouter } from '../routers/borrowing'
import { feedbackRouter } from '../routers/feedback'
import { libraryRouter } from '../routers/library'
import { tenantRouter } from '../routers/tenant'

const appRouter = router({
  auth: authRouter,
  book: bookRouter,
  borrowing: borrowingRouter,
  library: libraryRouter,
  feedback: feedbackRouter,
  tenant: tenantRouter,
})

const app = new Hono<AppContext>()

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }))

// Serve stored cover images from R2 (same-origin, long-cache). Keys are
// content-addressed, so immutable caching is safe.
app.get('/covers/:key', async (c) => {
  const r2 = c.env.COVERS
  if (!r2) return c.notFound()
  const obj = await r2.get(c.req.param('key'))
  if (!obj) return c.notFound()
  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/jpeg')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

// Better Auth HTTP routes (sign-in / sign-up / sign-out / get-session).
app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
  const auth = c.get('auth')
  return auth.handler(c.req.raw)
})

// tRPC
app.use('/api/trpc/*', (c) => {
  return fetchRequestHandler({
    req: c.req.raw,
    router: appRouter,
    endpoint: '/api/trpc',
    async createContext({ req, resHeaders }) {
      const db = c.get('db')
      const auth = c.get('auth')
      const sessionData = await auth.api.getSession({ headers: req.headers })
      return {
        req,
        resHeaders,
        env: c.env,
        db,
        session: sessionData?.session ?? null,
        user: (sessionData?.user ?? null) as never,
      }
    },
    batching: { enabled: true },
    onError({ error, path }) {
      console.error('tRPC error on path', path, ':', error.message)
    },
  })
})

export { appRouter }
export type AppRouter = typeof appRouter
export default app
