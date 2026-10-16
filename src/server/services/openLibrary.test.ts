import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupIsbnMetadata } from './openLibrary'

function mockFetchOnce(responses: Record<string, { status: number; body?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const match = Object.keys(responses).find((k) => url.includes(k))
      const r = match ? responses[match] : { status: 404 }
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? {},
      } as Response
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lookupIsbnMetadata', () => {
  it('returns normalized metadata and resolves the author name', async () => {
    mockFetchOnce({
      '/isbn/9780132350884.json': {
        status: 200,
        body: {
          title: 'Clean Code',
          authors: [{ key: '/authors/OL1A' }],
          publishers: ['Prentice Hall'],
          publish_date: 'August 2008',
        },
      },
      '/authors/OL1A.json': { status: 200, body: { name: 'Robert C. Martin' } },
    })

    const meta = await lookupIsbnMetadata('978-0-13-235088-4') // dashed input
    expect(meta).not.toBeNull()
    expect(meta).toMatchObject({
      isbn: '9780132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      publisher: 'Prentice Hall',
      publishedYear: 2008,
    })
  })

  // --- Negation ---
  it('returns null when the ISBN is not found (404)', async () => {
    mockFetchOnce({ '/isbn/9999999999999.json': { status: 404 } })
    expect(await lookupIsbnMetadata('9999999999999')).toBeNull()
  })

  it('returns null for an invalid ISBN length (no network call needed)', async () => {
    mockFetchOnce({})
    expect(await lookupIsbnMetadata('123')).toBeNull()
  })
})
