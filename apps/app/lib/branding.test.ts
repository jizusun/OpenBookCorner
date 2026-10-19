import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchBranding } from './branding'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('fetchBranding', () => {
  it('returns the branding body for a tenant slug', async () => {
    const branding = { name: 'Acme', logoUrl: null, brandColor: '#000', loginWelcome: null }
    mockFetch(() => new Response(JSON.stringify(branding), { status: 200 }))
    await expect(fetchBranding('acme')).resolves.toEqual(branding)
  })

  it('returns null without calling the API when slug is undefined (apex login)', async () => {
    const spy = vi.fn(() => new Response('null', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await expect(fetchBranding(undefined)).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns null for an unknown slug (endpoint responds 200 with null)', async () => {
    mockFetch(() => new Response('null', { status: 200 }))
    await expect(fetchBranding('nope')).resolves.toBeNull()
  })

  it('returns null (never throws) on a non-ok response', async () => {
    mockFetch(() => new Response('oops', { status: 500 }))
    await expect(fetchBranding('acme')).resolves.toBeNull()
  })

  it('returns null (never throws) on a network error', async () => {
    mockFetch(() => Promise.reject(new Error('offline')))
    await expect(fetchBranding('acme')).resolves.toBeNull()
  })

  it('queries ?slug= and sends credentials (same-origin cookie-aware)', async () => {
    const spy = vi.fn(() => new Response('null', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    await fetchBranding('acme')
    expect(spy).toHaveBeenCalledWith('/api/public/branding?slug=acme', { credentials: 'include' })
  })
})
