import type { BookMetadata } from './openLibrary'

// Google Books provider — free, no API key for basic volume lookups, and notably
// better coverage for Chinese (and other non-English) titles than Open Library.

interface GoogleVolume {
  volumeInfo?: {
    title?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    categories?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}
interface GoogleBooksResponse {
  totalItems?: number
  items?: GoogleVolume[]
}

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

function parseYear(publishedDate?: string): number | undefined {
  if (!publishedDate) return undefined
  const m = publishedDate.match(/\b(\d{4})\b/)
  return m ? Number(m[1]) : undefined
}

export async function lookupGoogleBooks(isbnRaw: string): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(isbnRaw)
  if (isbn.length !== 10 && isbn.length !== 13) return null

  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=US`
  let data: GoogleBooksResponse | null = null
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    data = (await res.json()) as GoogleBooksResponse
  } catch {
    return null
  }

  const info = data?.items?.[0]?.volumeInfo
  if (!info || !info.title) return null

  // Prefer a cover from Google; upgrade http→https and zoom.
  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  const coverImageUrl = cover ? cover.replace('http://', 'https://') : undefined

  return {
    isbn,
    title: info.title.trim(),
    author: info.authors?.join(', ') || 'Unknown',
    publisher: info.publisher?.trim(),
    publishedYear: parseYear(info.publishedDate),
    coverImageUrl,
    description: info.description?.trim(),
    subjects: info.categories?.slice(0, 8),
  }
}
