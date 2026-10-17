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
  // Origin/CSRF trust. ALWAYS trust the configured APP_ORIGIN. In production we
  // additionally trust every origin in the APP_ORIGINS allow-list, so the app
  // can be fronted by multiple public domains at once — the global Cloudflare
  // domain AND a China relay (Traefik) on a different domain — without failing
  // CSRF/origin checks on the relayed domain. In non-production we additionally
  // trust localhost (dev/E2E) and our OWN preview subdomains
  // (*.openbookcorner.jizu.dev — only we can deploy there). We deliberately do
  // NOT trust *.workers.dev: anyone can deploy a Worker on *.workers.dev, so a
  // broad wildcard there would let an attacker-controlled origin pass Better
  // Auth's CSRF/origin check (flagged by Copilot review).
  const allowListed = (env.APP_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const trustedOrigins =
    env.ENVIRONMENT === 'production'
      ? Array.from(new Set([env.APP_ORIGIN, ...allowListed]))
      : [
          env.APP_ORIGIN,
          'http://localhost:*',
          'http://127.0.0.1:*',
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
