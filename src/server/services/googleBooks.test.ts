import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupGoogleBooks } from './googleBooks'

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 404),
      json: async () => response.body ?? {},
    })) as unknown as typeof fetch,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('lookupGoogleBooks', () => {
  it('maps a Google Books volume (incl. a Chinese title) to BookMetadata', async () => {
    mockFetch({
      ok: true,
      body: {
        totalItems: 1,
        items: [
          {
            volumeInfo: {
              title: '活着',
              authors: ['余华'],
              publisher: '作家出版社',
              publishedDate: '2012',
              description: '一部关于苦难与坚韧的小说。',
              categories: ['Fiction'],
              imageLinks: { thumbnail: 'http://books.google/cover.jpg' },
            },
          },
        ],
      },
    })

    const meta = await lookupGoogleBooks('9787568922579')
    expect(meta).toMatchObject({
      isbn: '9787568922579',
      title: '活着',
      author: '余华',
      publisher: '作家出版社',
      publishedYear: 2012,
    })
    // cover upgraded to https
    expect(meta?.coverImageUrl).toBe('https://books.google/cover.jpg')
    expect(meta?.subjects).toEqual(['Fiction'])
  })

  // --- Negation ---
  it('returns null when Google Books has no items', async () => {
    mockFetch({ ok: true, body: { totalItems: 0, items: [] } })
    expect(await lookupGoogleBooks('9780000000000')).toBeNull()
  })

  it('returns null for an invalid ISBN length', async () => {
    mockFetch({ ok: true, body: {} })
    expect(await lookupGoogleBooks('123')).toBeNull()
  })
})
