import { describe, it, expect, vi, afterEach } from 'vitest'
import { storeCoverImage } from './covers'

// Minimal in-memory R2 bucket stub (only the methods storeCoverImage uses).
function makeR2() {
  const store = new Map<string, { body: ArrayBuffer; httpMetadata?: { contentType?: string } }>()
  return {
    store,
    async put(key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      store.set(key, { body, httpMetadata: opts?.httpMetadata })
    },
    async get(key: string) {
      const v = store.get(key)
      return v ? { body: v.body, httpMetadata: v.httpMetadata } : null
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('storeCoverImage', () => {
  it('fetches the external image, stores it in R2, and returns a /covers/ path', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => bytes,
      })) as unknown as typeof fetch,
    )
    const r2 = makeR2()
    const url = await storeCoverImage(r2 as unknown as R2Bucket, 'https://covers.example/x.jpg')
    expect(url).toMatch(/^\/covers\/[a-f0-9]+\.jpg$/)
    // The object is actually in the bucket under the returned key.
    const key = url!.replace('/covers/', '')
    expect(r2.store.has(key)).toBe(true)
    expect(r2.store.get(key)!.httpMetadata?.contentType).toBe('image/jpeg')
  })

  it('is deterministic: the same source URL maps to the same R2 key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => new Uint8Array([9]).buffer,
      })) as unknown as typeof fetch,
    )
    const r2 = makeR2()
    const a = await storeCoverImage(r2 as unknown as R2Bucket, 'https://covers.example/same.jpg')
    const b = await storeCoverImage(r2 as unknown as R2Bucket, 'https://covers.example/same.jpg')
    expect(a).toBe(b)
  })

  it('keys the object by ISBN when provided (cover-<isbn>.ext)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => new Uint8Array([7, 7]).buffer,
      })) as unknown as typeof fetch,
    )
    const r2 = makeR2()
    const url = await storeCoverImage(
      r2 as unknown as R2Bucket,
      'https://covers.example/z.png',
      '978-0-13-235088-4',
    )
    expect(url).toBe('/covers/cover-9780132350884.png')
    expect(r2.store.has('cover-9780132350884.png')).toBe(true)
  })

  it('returns null when the source cannot be fetched (caller keeps the original URL)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch,
    )
    const r2 = makeR2()
    const url = await storeCoverImage(r2 as unknown as R2Bucket, 'https://covers.example/missing.jpg')
    expect(url).toBeNull()
  })

  it('returns null for a falsy/empty source url', async () => {
    const r2 = makeR2()
    expect(await storeCoverImage(r2 as unknown as R2Bucket, '')).toBeNull()
    expect(await storeCoverImage(r2 as unknown as R2Bucket, undefined)).toBeNull()
  })
})
