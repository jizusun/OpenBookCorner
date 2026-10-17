// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isLikelyOffline } from './connectivity'

afterEach(() => vi.unstubAllGlobals())

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })
}

describe('isLikelyOffline (WeChat-safe)', () => {
  it('returns false when navigator.onLine is true (no network probe needed)', async () => {
    setOnline(true)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await isLikelyOffline()).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does NOT trust navigator.onLine=false alone: probes, and if the probe succeeds reports ONLINE', async () => {
    // WeChat WebView falsely reports offline; a successful probe proves we are online.
    setOnline(false)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response))
    expect(await isLikelyOffline()).toBe(false)
  })

  it('reports offline only when onLine=false AND the probe fails', async () => {
    setOnline(false)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network error')
      }),
    )
    expect(await isLikelyOffline()).toBe(true)
  })
})
