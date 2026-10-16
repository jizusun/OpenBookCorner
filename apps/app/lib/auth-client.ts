import { createAuthClient } from 'better-auth/react'

/** Better Auth browser client. Talks to the API worker's /api/auth routes. */
export const authClient = createAuthClient({
  baseURL: '/api/auth',
})

export const { signIn, signOut, signUp, useSession } = authClient
