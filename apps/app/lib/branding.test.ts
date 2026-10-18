import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchBranding } from './branding'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('fetchBranding', () => {
  it('returns the branding body on a tenant host', async () => {
    const branding = { name: 'Acme', logoUrl: null, brandColor: '#000', loginWelcome: null }
    mockFetch(() => new Response(JSON.stringify(branding), { status: 200 }))
    await expect(fetchBranding()).resolves.toEqual(branding)
  })

  it('returns null on the apex (endpoint responds 200 with null)', async () => {
    mockFetch(() => new Response('null', { status: 200 }))
    await expect(fetchBranding()).resolves.toBeNull()
  })

  it('returns null (never throws) on a non-ok response', async () => {
    mockFetch(() => new Response('oops', { status: 500 }))
    await expect(fetchBranding()).resolves.toBeNull()
  })

  it('returns null (never throws) on a network error', async () => {
    mockFetch(() => Promise.reject(new Error('offline')))
    await expect(fetchBranding()).resolves.toBeNull()
  })

  it('sends credentials so the request is same-origin cookie-aware', async () => {
    const spy = vi.fn(() => new Response('null', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await fetchBranding()
    expect(spy).toHaveBeenCalledWith('/api/public/branding', { credentials: 'include' })
  })
})
