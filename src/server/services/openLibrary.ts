// Anti-corruption layer for external book metadata (Open Library).
// Isolates the domain from Open Library's response shape.

export interface BookMetadata {
  isbn: string
  title: string
  author: string
  publisher?: string
  publishedYear?: number
}

interface OpenLibraryBook {
  title?: string
  authors?: Array<{ key: string }>
  publishers?: string[]
  publish_date?: string
  by_statement?: string
}

interface OpenLibraryAuthor {
  name?: string
}

const OL_BASE = 'https://openlibrary.org'

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

function parseYear(publishDate?: string): number | undefined {
  if (!publishDate) return undefined
  const m = publishDate.match(/\b(\d{4})\b/)
  return m ? Number(m[1]) : undefined
}

/**
 * Looks up book metadata by ISBN from Open Library.
 * Returns null when the ISBN is not found (caller falls back to manual entry).
 */
export async function lookupIsbnMetadata(isbnRaw: string): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(isbnRaw)
  if (isbn.length !== 10 && isbn.length !== 13) return null

  const res = await fetch(`${OL_BASE}/isbn/${isbn}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'OpenBookCorner/1.0' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`ISBN lookup failed (${res.status})`)

  const book = (await res.json()) as OpenLibraryBook

  // Resolve the first author's name (Open Library returns author refs).
  let author = book.by_statement?.trim() ?? ''
  const authorKey = book.authors?.[0]?.key
  if (!author && authorKey) {
    try {
      const aRes = await fetch(`${OL_BASE}${authorKey}.json`, {
        headers: { Accept: 'application/json', 'User-Agent': 'OpenBookCorner/1.0' },
      })
      if (aRes.ok) {
        const a = (await aRes.json()) as OpenLibraryAuthor
        author = a.name?.trim() ?? ''
      }
    } catch {
      // Non-fatal: leave author blank for manual entry.
    }
  }

  return {
    isbn,
    title: book.title?.trim() ?? '',
    author: author || 'Unknown',
    publisher: book.publishers?.[0]?.trim(),
    publishedYear: parseYear(book.publish_date),
  }
}
