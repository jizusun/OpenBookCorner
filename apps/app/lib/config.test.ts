import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchConfig, isDemoVisible } from './config'

afterEach(() => vi.restoreAllMocks())

describe('fetchConfig', () => {
  it('returns the config body', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Response(JSON.stringify({ environment: 'preview' }), { status: 200 })))
    await expect(fetchConfig()).resolves.toEqual({ environment: 'preview' })
  })

  it('returns null (never throws) on a non-ok response or network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Response('oops', { status: 500 })))
    await expect(fetchConfig()).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    await expect(fetchConfig()).resolves.toBeNull()
  })

  it('sends credentials (same-origin cookie-aware)', async () => {
    const spy = vi.fn(() => new Response('{"environment":"development"}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await fetchConfig()
    expect(spy).toHaveBeenCalledWith('/api/public/config', { credentials: 'include' })
  })
})

describe('isDemoVisible (non-production gate, fail-closed)', () => {
  it('is true only for a known non-production environment', () => {
    expect(isDemoVisible({ environment: 'preview' })).toBe(true)
    expect(isDemoVisible({ environment: 'development' })).toBe(true)
    expect(isDemoVisible({ environment: 'staging' })).toBe(true)
  })

  it('is false for production and fails closed on unknown/null', () => {
    expect(isDemoVisible({ environment: 'production' })).toBe(false)
    expect(isDemoVisible({ environment: '' })).toBe(false)
    expect(isDemoVisible(null)).toBe(false)
  })
})
