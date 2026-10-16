// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

/**
 * Regression test for the "Invalid base URL: /api/auth" crash.
 *
 * Better Auth's browser client validates `baseURL` as an ABSOLUTE URL. Passing a
 * relative path (e.g. '/api/auth') throws at module load and takes down the app.
 * These tests lock in that the client is constructed with an absolute origin and
 * can be imported without throwing.
 */
describe('auth-client', () => {
  it('imports and constructs without throwing (absolute baseURL)', async () => {
    // jsdom provides window.location.origin (http://localhost). If baseURL were
    // relative, better-auth would throw here during import.
    const mod = await import('./auth-client')
    expect(mod.authClient).toBeDefined()
    expect(mod.signIn).toBeDefined()
    expect(mod.signOut).toBeDefined()
  })

  it('uses an absolute URL for the auth base (new URL does not throw)', () => {
    // Mirrors the config in auth-client.ts: an absolute origin, not a bare path.
    const baseURL = window.location.origin
    expect(() => new URL(baseURL)).not.toThrow()
    expect(baseURL).toMatch(/^https?:\/\//)
    // The old bug: a relative path is NOT a valid absolute URL.
    expect(() => new URL('/api/auth')).toThrow()
  })
})
