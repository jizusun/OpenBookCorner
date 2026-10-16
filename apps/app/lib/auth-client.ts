import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth browser client. The client validates `baseURL` as an absolute URL,
 * so we derive it from the current origin (same-origin: the app worker proxies
 * /api/* to the API worker). `basePath` defaults to '/api/auth'.
 */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  basePath: '/api/auth',
})

export const { signIn, signOut, signUp, useSession } = authClient

