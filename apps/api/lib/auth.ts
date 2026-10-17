import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { account, schema as Db, session, user, verification, type Database } from '@obc/db'

import type { Env } from './env'

/**
 * Better Auth for OpenBookCorner — Phase 1 email/password on Cloudflare D1.
 *
 * We extend the `user` table with tenant fields (libraryId, role) via
 * additionalFields so they ride along on the session user object. No Stripe,
 * organizations, passkeys, or OTP (dropped from the react-starter-kit baseline).
 */
export function createAuth(db: Database, env: Env): Auth {
  // Trust the configured origin in all environments; additionally trust localhost
  // (dev/E2E) and Workers preview URLs (*.workers.dev) in non-production so a
  // Workers Builds *preview* can complete auth on its generated preview origin.
  const trustedOrigins =
    env.ENVIRONMENT === 'production'
      ? [env.APP_ORIGIN]
      : [
          env.APP_ORIGIN,
          'http://localhost:*',
          'http://127.0.0.1:*',
          'https://*.workers.dev',
          'https://*.openbookcorner.jizu.dev',
        ]

  const options: BetterAuthOptions = {
    baseURL: `${env.APP_ORIGIN}/api/auth`,
    trustedOrigins,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Phase 1: no email provider wired yet; readers are created via seed/admin.
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        libraryId: { type: 'string', required: false, input: false },
        role: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: 'library_reader',
        },
      },
    },
    advanced: {
      // D1 generates string ids; let Better Auth create them.
      database: { generateId: () => crypto.randomUUID() },
    },
  }

  // Reference Db to keep the import used even if tree-shaken in some builds.
  void Db
  return betterAuth(options)
}

export type Auth = ReturnType<typeof betterAuth>
type SessionResponse = Auth['$Infer']['Session']
export type AuthUser = SessionResponse['user'] & {
  libraryId?: string | null
  role?: string | null
}
export type AuthSession = SessionResponse['session']
