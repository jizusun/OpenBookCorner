import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BookMetadata } from './openLibrary'

// Mock both providers so we can assert fallback + merge behaviour deterministically.
const olMock = vi.fn<(isbn: string) => Promise<BookMetadata | null>>()
const gbMock = vi.fn<(isbn: string) => Promise<BookMetadata | null>>()

vi.mock('./openLibrary', () => ({ lookupIsbnMetadata: (isbn: string) => olMock(isbn) }))
vi.mock('./googleBooks', () => ({ lookupGoogleBooks: (isbn: string) => gbMock(isbn) }))

const { lookupBookMetadata } = await import('./bookMetadata')

beforeEach(() => {
  olMock.mockReset()
  gbMock.mockReset()
})

describe('lookupBookMetadata (multi-provider resolver)', () => {
  it('falls back to Google Books when Open Library misses (Chinese book)', async () => {
    olMock.mockResolvedValue(null)
    gbMock.mockResolvedValue({ isbn: '9787568922579', title: '活着', author: '余华' })

    const meta = await lookupBookMetadata('9787568922579')
    expect(meta?.title).toBe('活着')
  })

  it('merges fields from both providers (fills gaps)', async () => {
    olMock.mockResolvedValue({
      isbn: '1',
      title: 'T',
      author: 'A',
      description: 'rich description',
    })
    gbMock.mockResolvedValue({
      isbn: '1',
      title: 'T',
      author: 'A',
      publisher: 'Pub',
      coverImageUrl: 'https://c/1.jpg',
    })

    const meta = await lookupBookMetadata('1')
    // Base is OL (has description); publisher + cover filled from Google.
    expect(meta).toMatchObject({
      description: 'rich description',
      publisher: 'Pub',
      coverImageUrl: 'https://c/1.jpg',
    })
  })

  // --- Negation ---
  it('returns null when no provider has the book', async () => {
    olMock.mockResolvedValue(null)
    gbMock.mockResolvedValue(null)
    expect(await lookupBookMetadata('9780000000000')).toBeNull()
  })

  it('survives a provider throwing (uses the other)', async () => {
    olMock.mockRejectedValue(new Error('network'))
    gbMock.mockResolvedValue({ isbn: '1', title: 'OnlyGoogle', author: 'A' })
    const meta = await lookupBookMetadata('1')
    expect(meta?.title).toBe('OnlyGoogle')
  })
})
