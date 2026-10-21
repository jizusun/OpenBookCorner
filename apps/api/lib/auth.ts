import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { account, schema as Db, session, user, verification, type Database } from '@obc/db'

import type { Env } from './env'
import { IMPERSONATION_DURATION_SECONDS } from './impersonation'
import { auditImpersonationStart, auditImpersonationStop } from './impersonation-audit'

// Access control for the admin plugin. When `adminRoles` names a custom role
// (super_admin), Better Auth REQUIRES that role be defined in `roles` — otherwise
// createAuth throws "Invalid admin roles" at construction (500 on every route).
// super_admin gets the full admin statement set (incl. user:impersonate).
const ac = createAccessControl(defaultStatements)
const superAdminRole = ac.newRole(adminAc.statements)

/**
 * Better Auth for OpenBookCorner — Phase 1 email/password on Cloudflare D1.
 *
 * We extend the `user` table with tenant fields (libraryId, role) via
 * additionalFields so they ride along on the session user object. No Stripe,
 * organizations, passkeys, or OTP (dropped from the react-starter-kit baseline).
 */
export function createAuth(db: Database, env: Env): Auth {
  // Origin/CSRF trust. ALWAYS trust the configured APP_ORIGIN. In non-production
  // additionally trust localhost (dev/E2E) and our OWN preview subdomains
  // (*.openbookcorner.jizu.dev — only we can deploy there). We deliberately do
  // NOT trust *.workers.dev: anyone can deploy a Worker on *.workers.dev, so a
  // broad wildcard there would let an attacker-controlled origin pass Better
  // Auth's CSRF/origin check (flagged by Copilot review).
  const trustedOrigins =
    env.ENVIRONMENT === 'production'
      ? [env.APP_ORIGIN]
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
        // ADR 0009: the user's currently-selected library (drives tenant scope).
        activeLibraryId: { type: 'string', required: false, input: false },
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
    plugins: [
      // Admin plugin — we use ONLY its impersonation endpoints (ADR 0004 Part B).
      // `adminRoles: ['super_admin']` means only super admins may impersonate,
      // and (allowImpersonatingAdmins defaults false) they CANNOT impersonate
      // another super admin. Impersonation sessions are time-boxed.
      admin({
        ac,
        roles: { super_admin: superAdminRole },
        adminRoles: ['super_admin'],
        // New sign-ups default to library_reader (our role set). WITHOUT this the
        // admin plugin assigns its own default role 'user', which is outside our
        // {super_admin, library_admin, library_reader} set and breaks role-based
        // UI/guards (e.g. empty Role column, no impersonate affordance).
        defaultRole: 'library_reader',
        impersonationSessionDuration: IMPERSONATION_DURATION_SECONDS,
      }),
    ],
    databaseHooks: {
      session: {
        // Audit impersonation server-side so it can't be bypassed from the client.
        // A session with `impersonatedBy` set is an impersonation; resolve the
        // impersonated user's tenant and record impersonation.start / .stop.
        create: {
          before: async (newSession) => {
            // Server-side guard (ADR 0006): an impersonation session (one with
            // impersonatedBy set) may only target a library_reader — mirrors the
            // UI allow-list and the admin plugin's admin block, and closes the
            // gap for empty/unknown roles. Non-readers are refused.
            const impersonatedBy = (newSession as { impersonatedBy?: string | null })
              .impersonatedBy
            if (!impersonatedBy) return
            const targetUserId = (newSession as { userId: string }).userId
            const row = await db
              .select({ role: user.role })
              .from(user)
              .where(eq(user.id, targetUserId))
              .get?.()
            if (row?.role !== 'library_reader') {
              throw new Error('IMPERSONATION_TARGET_NOT_READER')
            }
          },
          after: async (newSession) => {
            const impersonatedBy = (newSession as { impersonatedBy?: string | null })
              .impersonatedBy
            if (!impersonatedBy) return
            const targetUserId = (newSession as { userId: string }).userId
            const row = await db
              .select({ libraryId: user.libraryId })
              .from(user)
              .where(eq(user.id, targetUserId))
              .get?.()
            await auditImpersonationStart(db, {
              impersonatedBy,
              targetUserId,
              targetLibraryId: row?.libraryId ?? null,
            })
          },
        },
        delete: {
          after: async (oldSession) => {
            const impersonatedBy = (oldSession as { impersonatedBy?: string | null })
              .impersonatedBy
            if (!impersonatedBy) return
            const targetUserId = (oldSession as { userId: string }).userId
            const row = await db
              .select({ libraryId: user.libraryId })
              .from(user)
              .where(eq(user.id, targetUserId))
              .get?.()
            await auditImpersonationStop(db, {
              impersonatedBy,
              targetUserId,
              targetLibraryId: row?.libraryId ?? null,
            })
          },
        },
      },
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
  activeLibraryId?: string | null
  role?: string | null
}
export type AuthSession = SessionResponse['session']
