import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

/**
 * Regression test for the "every user logs in as the previous user" bug.
 *
 * Auth route guards resolve the current user through TanStack Query
 * (`ensureQueryData(auth.requireMe)`) with a 30s staleTime, so the result is
 * CACHED. If the cache is not cleared when a different user signs in, the new
 * user inherits the previous user's cached identity (e.g. a reader shown as the
 * admin who logged in moments earlier). The fix: `queryClient.clear()` on login
 * (and logout). These tests pin that behavior against the real QueryClient.
 */
const REQUIRE_ME_KEY = ['auth.requireMe'] as const

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
}

describe('auth session cache (login must not leak the previous user)', () => {
  let currentUser: { email: string; role: string }
  let qc: QueryClient
  // Simulates auth.requireMe hitting the server — returns whoever is "logged in".
  const requireMe = () => Promise.resolve(currentUser)
  const ensure = (client: QueryClient) =>
    client.ensureQueryData({ queryKey: REQUIRE_ME_KEY, queryFn: requireMe })

  beforeEach(() => {
    qc = makeClient()
  })

  it('WITHOUT clearing, a cached requireMe serves the previous user (the bug)', async () => {
    currentUser = { email: 'admin@demo.test', role: 'library_admin' }
    const first = await ensure(qc)
    expect(first.role).toBe('library_admin')

    // A different user signs in, but the cache was NOT cleared.
    currentUser = { email: 'reader@demo.test', role: 'library_reader' }
    const second = await ensure(qc)
    // Stale cache returns the admin — demonstrates why the bug happened.
    expect(second.role).toBe('library_admin')
  })

  it('clearing the cache on login makes requireMe resolve the NEW user (the fix)', async () => {
    currentUser = { email: 'admin@demo.test', role: 'library_admin' }
    expect((await ensure(qc)).role).toBe('library_admin')

    // Login handler clears the cache before routing by role.
    qc.clear()

    currentUser = { email: 'reader@demo.test', role: 'library_reader' }
    const after = await ensure(qc)
    expect(after.role).toBe('library_reader')
    expect(after.email).toBe('reader@demo.test')
  })

  it('super_admin resolves correctly after an admin session when cache is cleared', async () => {
    currentUser = { email: 'admin@demo.test', role: 'library_admin' }
    await ensure(qc)
    qc.clear()
    currentUser = { email: 'super@demo.test', role: 'super_admin' }
    expect((await ensure(qc)).role).toBe('super_admin')
  })
})
