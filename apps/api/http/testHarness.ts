/**
 * Integration test harness for the real Hono backend (`serverApp`). It wires up
 * the SAME context the Worker sets (`db`, `auth`, `env`) and lets a test inject:
 *
 * - a real sql.js test db (`createTestDb` from @obc/db/testing),
 * - a STUB `auth` whose `api.getSession` returns a configurable
 *   `{ user, session }` (or null) — so the mw guards can be exercised without a
 *   real Better Auth cookie round-trip,
 * - the parsed `env` (APP_ORIGIN drives the base domain for subdomain tests).
 *
 * This fills the missing middle of the testing pyramid: the mw guards
 * (sessionAuth → tenant → admin → superAdmin) and the subdomain enforcement are
 * covered against the real composed app, not just E2E.
 */
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'

import type { Auth, AuthSession, AuthUser } from '../lib/auth'
import type { Env } from '../lib/env'
import type { BaseVars, RateLimiter } from '../lib/mw'
import { serverApp } from './server'
import { user as dbUser, type Database } from '@obc/db'

/** The minimal session shape the guards read off the stub auth. */
export interface StubSessionUser {
  id: string
  email?: string
  name?: string
  libraryId?: string | null
  activeLibraryId?: string | null
  role?: string | null
}

export interface HarnessOptions {
  db: Database
  /**
   * The session this request is authenticated as, or `null` for anonymous.
   * Mirrors the shape returned by Better Auth's `auth.api.getSession`.
   */
  session?: StubSessionUser | null
  /** Override the configured APP_ORIGIN (defaults to the apex). */
  appOrigin?: string
  /** Override the environment (defaults to development). */
  environment?: Env['ENVIRONMENT']
  /** Inject a rate limiter (for the public-endpoint 429 tests). */
  rateLimiter?: RateLimiter
}

/** Build a stub `auth` whose `getSession` always resolves to the given session. */
export function createStubAuth(session: StubSessionUser | null, db?: Database): Auth {
  const data =
    session == null
      ? null
      : {
          user: {
            id: session.id,
            email: session.email ?? `${session.id}@test.com`,
            name: session.name ?? session.id,
            libraryId: session.libraryId ?? null,
            activeLibraryId: session.activeLibraryId ?? null,
            role: session.role ?? null,
          } as unknown as AuthUser,
          session: { id: `sess-${session.id}`, userId: session.id } as unknown as AuthSession,
        }

  return {
    api: {
      getSession: async () => data,
      // Minimal stand-in for the admin plugin's createUser: inserts a user row
      // so onboard integration tests can exercise our guards + tenant scoping +
      // member link + audit. The real password hash / login is covered by E2E.
      createUser: async (opts: { body: { email: string; name: string } }) => {
        const id = `user-${opts.body.email}`
        if (db) {
          await db.insert(dbUser).values({
            id,
            email: opts.body.email,
            name: opts.body.name,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
        return { user: { id } }
      },
    },
  } as unknown as Auth
}

/**
 * Returns an app that sets `db`/`auth`/`env` on context (the way the Worker
 * does) and then delegates to the real `serverApp`. Exercise it with
 * `app.request(new Request(...))`.
 */
export function createTestServer(opts: HarnessOptions) {
  const appOrigin = opts.appOrigin ?? 'https://openbookcorner.jizu.dev'
  const environment = opts.environment ?? 'development'
  const env = {
    ENVIRONMENT: environment,
    APP_NAME: 'OpenBookCorner',
    APP_ORIGIN: appOrigin,
    BETTER_AUTH_SECRET: 'test-only-insecure-secret-change-me',
    RESEND_FROM: 'test@example.com',
    DB: undefined as unknown as D1Database,
    COVERS: undefined as unknown as R2Bucket,
  } satisfies Env

  const auth = createStubAuth(opts.session ?? null, opts.db)

  const setup = createMiddleware<{ Variables: BaseVars }>(async (c, next) => {
    c.set('db', opts.db)
    c.set('auth', auth)
    c.set('env', env)
    c.set('email', new (await import('../services/email')).EmailService(undefined, 'test@example.com'))
    if (opts.rateLimiter) c.set('rateLimiter', opts.rateLimiter)
    await next()
  })

  return new Hono<{ Variables: BaseVars }>().use('*', setup).route('/', serverApp)
}
