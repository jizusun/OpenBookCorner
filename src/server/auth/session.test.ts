import { describe, it, expect } from 'vitest'
import {
  SESSION_COOKIE,
  readSessionCookie,
  buildSessionCookie,
  buildBlankSessionCookie,
} from './session'

describe('session cookie helpers', () => {
  it('reads the session id from a cookie header', () => {
    expect(readSessionCookie(`${SESSION_COOKIE}=abc123`)).toBe('abc123')
    expect(readSessionCookie(`other=x; ${SESSION_COOKIE}=abc123; more=y`)).toBe('abc123')
  })

  it('builds an httpOnly secure cookie with max-age', () => {
    const c = buildSessionCookie('sid')
    expect(c).toContain(`${SESSION_COOKIE}=sid`)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Max-Age=')
  })

  it('blank cookie expires the session (Max-Age=0)', () => {
    expect(buildBlankSessionCookie()).toContain('Max-Age=0')
  })

  // --- Negation tests ---
  it('returns null when the cookie header is missing or lacks the session cookie', () => {
    expect(readSessionCookie(null)).toBeNull()
    expect(readSessionCookie('')).toBeNull()
    expect(readSessionCookie('foo=bar; baz=qux')).toBeNull()
  })
})
