import { describe, it, expect } from 'vitest'

import {
  isAllowedOrigin,
  isValidSlug,
  parseOriginPatterns,
  resolveEffectiveOrigin,
  resolveTenantPath,
} from './tenant'

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric + hyphen, 2–40 chars', () => {
    expect(isValidSlug('acme')).toBe(true)
    expect(isValidSlug('a1')).toBe(true)
    expect(isValidSlug('my-library-2')).toBe(true)
    expect(isValidSlug('a'.repeat(40))).toBe(true)
  })

  it('rejects too short/long, uppercase, spaces, dots, leading/trailing hyphen', () => {
    expect(isValidSlug('a')).toBe(false) // too short
    expect(isValidSlug('a'.repeat(41))).toBe(false) // too long
    expect(isValidSlug('Acme')).toBe(false) // uppercase
    expect(isValidSlug('ac me')).toBe(false) // space
    expect(isValidSlug('ac.me')).toBe(false) // dot
    expect(isValidSlug('-acme')).toBe(false) // leading hyphen
    expect(isValidSlug('acme-')).toBe(false) // trailing hyphen
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects reserved slugs (route-colliding words)', () => {
    expect(isValidSlug('admin')).toBe(false)
    expect(isValidSlug('api')).toBe(false)
    expect(isValidSlug('login')).toBe(false)
  })
})

describe('resolveTenantPath (/t/:slug path-based tenants)', () => {
  it('returns the slug for a /t/:slug path', () => {
    expect(resolveTenantPath('/t/acme')).toBe('acme')
    expect(resolveTenantPath('/t/acme/')).toBe('acme')
    expect(resolveTenantPath('/t/acme/books')).toBe('acme')
    expect(resolveTenantPath('/t/my-lib/admin/members')).toBe('my-lib')
  })

  it('returns null when there is no /t/ prefix', () => {
    expect(resolveTenantPath('/')).toBeNull()
    expect(resolveTenantPath('/books')).toBeNull()
    expect(resolveTenantPath('/login')).toBeNull()
    expect(resolveTenantPath('')).toBeNull()
    expect(resolveTenantPath('/t')).toBeNull()
    expect(resolveTenantPath('/t/')).toBeNull()
  })

  it('returns null for an invalid or reserved slug segment', () => {
    expect(resolveTenantPath('/t/AC_ME')).toBeNull() // invalid chars
    expect(resolveTenantPath('/t/a')).toBeNull() // too short
    expect(resolveTenantPath('/t/admin')).toBeNull() // reserved
    expect(resolveTenantPath('/t/-acme/books')).toBeNull() // leading hyphen
  })
})

describe('isAllowedOrigin (proxy/relay allow-list, ADR 0003 §7)', () => {
  // Trusted: apex + any *.openbookcorner.jizu.dev (https), and the relay
  // *.cloud.jizu.dev on port 666 (https).
  const patterns = [
    { suffix: 'openbookcorner.jizu.dev', port: null }, // apex + subdomains, default https port
    { suffix: 'cloud.jizu.dev', port: 666 }, // relay on :666
  ]

  it('accepts the apex and tenant subdomains over https', () => {
    expect(isAllowedOrigin('https://openbookcorner.jizu.dev', patterns)).toBe(true)
    expect(isAllowedOrigin('https://acme.openbookcorner.jizu.dev', patterns)).toBe(true)
  })

  it('accepts the relay host on :666', () => {
    expect(isAllowedOrigin('https://obc.cloud.jizu.dev:666', patterns)).toBe(true)
    expect(isAllowedOrigin('https://acme.cloud.jizu.dev:666', patterns)).toBe(true)
  })

  it('rejects the ADR §7 spoof table', () => {
    // suffix confusion (no dot boundary)
    expect(isAllowedOrigin('https://evil-openbookcorner.jizu.dev', patterns)).toBe(false)
    // trusted string as a prefix of a longer host
    expect(isAllowedOrigin('https://openbookcorner.jizu.dev.evil.com', patterns)).toBe(false)
    // wrong port on the relay suffix
    expect(isAllowedOrigin('https://obc.cloud.jizu.dev:6666', patterns)).toBe(false)
    expect(isAllowedOrigin('https://obc.cloud.jizu.dev:80', patterns)).toBe(false)
    // relay suffix without the required port
    expect(isAllowedOrigin('https://obc.cloud.jizu.dev', patterns)).toBe(false)
    // wrong scheme
    expect(isAllowedOrigin('http://openbookcorner.jizu.dev', patterns)).toBe(false)
    // userinfo trick
    expect(isAllowedOrigin('https://openbookcorner.jizu.dev@evil.com', patterns)).toBe(false)
    // non-standard port on the https-default suffix
    expect(isAllowedOrigin('https://openbookcorner.jizu.dev:8443', patterns)).toBe(false)
    // garbage
    expect(isAllowedOrigin('not-a-url', patterns)).toBe(false)
    expect(isAllowedOrigin('', patterns)).toBe(false)
  })
})

describe('parseOriginPatterns (APP_ORIGINS parsing, ADR 0003 §7)', () => {
  it('parses a comma-separated list into suffix+port patterns', () => {
    const patterns = parseOriginPatterns(
      'https://openbookcorner.jizu.dev,https://obc.cloud.jizu.dev:666',
    )
    expect(patterns).toEqual([
      { suffix: 'openbookcorner.jizu.dev', port: null },
      { suffix: 'obc.cloud.jizu.dev', port: 666 },
    ])
  })

  it('trims whitespace and ignores empty entries', () => {
    expect(parseOriginPatterns(' https://a.jizu.dev , , https://b.jizu.dev:8443 ')).toEqual([
      { suffix: 'a.jizu.dev', port: null },
      { suffix: 'b.jizu.dev', port: 8443 },
    ])
  })

  it('skips non-https and garbage entries', () => {
    expect(parseOriginPatterns('http://insecure.jizu.dev,not-a-url,https://ok.jizu.dev')).toEqual([
      { suffix: 'ok.jizu.dev', port: null },
    ])
  })

  it('returns [] for undefined/empty', () => {
    expect(parseOriginPatterns(undefined)).toEqual([])
    expect(parseOriginPatterns('')).toEqual([])
  })
})

describe('resolveEffectiveOrigin (relay origin trust, ADR 0003 §7)', () => {
  const appOrigin = 'https://openbookcorner.jizu.dev'
  const patterns = parseOriginPatterns(
    'https://openbookcorner.jizu.dev,https://obc.cloud.jizu.dev:666',
  )

  it('honors an allow-listed X-Forwarded-Origin (relay on :666)', () => {
    expect(resolveEffectiveOrigin(appOrigin, 'https://obc.cloud.jizu.dev:666', patterns)).toBe(
      'https://obc.cloud.jizu.dev:666',
    )
  })

  it('honors an allow-listed tenant subdomain forwarded origin', () => {
    expect(
      resolveEffectiveOrigin(appOrigin, 'https://acme.openbookcorner.jizu.dev', patterns),
    ).toBe('https://acme.openbookcorner.jizu.dev')
  })

  it('falls back to appOrigin when no X-Forwarded-Origin is present', () => {
    expect(resolveEffectiveOrigin(appOrigin, undefined, patterns)).toBe(appOrigin)
  })

  it('ignores every ADR §7 spoof and falls back to appOrigin (no CSRF bypass)', () => {
    const spoofs = [
      'https://evil-openbookcorner.jizu.dev',
      'https://openbookcorner.jizu.dev.evil.com',
      'https://obc.cloud.jizu.dev:6666',
      'https://obc.cloud.jizu.dev:80',
      'https://obc.cloud.jizu.dev', // relay suffix without the required port
      'http://openbookcorner.jizu.dev',
      'https://openbookcorner.jizu.dev@evil.com',
      'https://openbookcorner.jizu.dev:8443',
      'not-a-url',
      '',
    ]
    for (const spoof of spoofs) {
      expect(resolveEffectiveOrigin(appOrigin, spoof, patterns)).toBe(appOrigin)
    }
  })
})
