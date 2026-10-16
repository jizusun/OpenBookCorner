// Anti-corruption layer for external book metadata (Open Library).
// Isolates the domain from Open Library's response shape.

export interface BookMetadata {
  isbn: string
  title: string
  author: string
  publisher?: string
  publishedYear?: number
  coverImageUrl?: string
  description?: string
  subjects?: string[]
}

interface OpenLibraryEdition {
  title?: string
  authors?: Array<{ key: string }>
  publishers?: string[]
  publish_date?: string
  by_statement?: string
  works?: Array<{ key: string }>
}

interface OpenLibraryAuthor {
  name?: string
}

interface OpenLibraryWork {
  description?: string | { value?: string }
  subjects?: string[]
}

const OL_BASE = 'https://openlibrary.org'
const OL_HEADERS = { Accept: 'application/json', 'User-Agent': 'OpenBookCorner/1.0' }

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase()
}

function parseYear(publishDate?: string): number | undefined {
  if (!publishDate) return undefined
  const m = publishDate.match(/\b(\d{4})\b/)
  return m ? Number(m[1]) : undefined
}

function coverUrl(isbn: string): string {
  // Open Library cover image by ISBN (large). Returns a blank image if none exists.
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: OL_HEADERS })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Looks up rich book metadata by ISBN from Open Library (edition + work + cover).
 * Returns null when the ISBN edition is not found (caller falls back to manual entry).
 */
export async function lookupIsbnMetadata(isbnRaw: string): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(isbnRaw)
  if (isbn.length !== 10 && isbn.length !== 13) return null

  const res = await fetch(`${OL_BASE}/isbn/${isbn}.json`, { headers: OL_HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`ISBN lookup failed (${res.status})`)

  const edition = (await res.json()) as OpenLibraryEdition

  // Resolve the first author's name (Open Library returns author refs).
  let author = edition.by_statement?.trim() ?? ''
  const authorKey = edition.authors?.[0]?.key
  if (!author && authorKey) {
    const a = await getJson<OpenLibraryAuthor>(`${OL_BASE}${authorKey}.json`)
    author = a?.name?.trim() ?? ''
  }

  // Fetch the work for description + subjects (discovery metadata).
  let description: string | undefined
  let subjects: string[] | undefined
  const workKey = edition.works?.[0]?.key
  if (workKey) {
    const work = await getJson<OpenLibraryWork>(`${OL_BASE}${workKey}.json`)
    if (work) {
      description =
        typeof work.description === 'string'
          ? work.description
          : work.description?.value
      subjects = work.subjects?.slice(0, 8)
    }
  }

  return {
    isbn,
    title: edition.title?.trim() ?? '',
    author: author || 'Unknown',
    publisher: edition.publishers?.[0]?.trim(),
    publishedYear: parseYear(edition.publish_date),
    coverImageUrl: coverUrl(isbn),
    description: description?.trim(),
    subjects,
  }
}
