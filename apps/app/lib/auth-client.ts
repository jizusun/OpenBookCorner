import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

/**
 * Better Auth browser client. The client validates `baseURL` as an absolute URL,
 * so we derive it from the current origin (same-origin: the app worker proxies
 * /api/* to the API worker). `basePath` defaults to '/api/auth'.
 *
 * This project builds with `composite: true` (declaration emission), which
 * surfaces TS2742 ("inferred type cannot be named") for the plugin-augmented
 * client type. Nothing consumes this package's `.d.ts`, but tsc still emits it,
 * so we expose the client through a narrow, nameable interface covering exactly
 * what the app uses (same spirit as the tRPC-client annotation in AGENTS.md).
 */
const rawAuthClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  basePath: '/api/auth',
  // Admin plugin client: adds authClient.admin.impersonateUser / stopImpersonating.
  plugins: [adminClient()],
})

interface ImpersonateArgs {
  userId: string
}
interface SignInResult {
  error?: { message?: string } | null
  data?: { user?: { role?: string } & Record<string, unknown> } | null
}
interface AuthClientFacade {
  signIn: { email: (args: { email: string; password: string }) => Promise<SignInResult> }
  signOut: () => Promise<unknown>
  signUp: { email: (args: { email: string; password: string; name: string }) => Promise<unknown> }
  updateUser: (args: { name?: string }) => Promise<{ error?: { message?: string } | null }>
  useSession: () => {
    data?: { user?: Record<string, unknown>; session?: { impersonatedBy?: string | null } } | null
    isPending?: boolean
  }
  admin: {
    impersonateUser: (args: ImpersonateArgs) => Promise<unknown>
    stopImpersonating: () => Promise<unknown>
  }
}

export const authClient = rawAuthClient as unknown as AuthClientFacade

export const signIn = authClient.signIn
export const signOut = authClient.signOut
export const signUp = authClient.signUp
export const useSession = authClient.useSession

