import { lookupIsbnMetadata as lookupOpenLibrary, type BookMetadata } from './openLibrary'
import { lookupGoogleBooks } from './googleBooks'

export type { BookMetadata }

// Fill empty fields of `base` from `extra` (first non-empty wins per field).
function merge(base: BookMetadata, extra: BookMetadata | null): BookMetadata {
  if (!extra) return base
  return {
    isbn: base.isbn,
    title: base.title || extra.title,
    author: base.author && base.author !== 'Unknown' ? base.author : extra.author,
    publisher: base.publisher ?? extra.publisher,
    publishedYear: base.publishedYear ?? extra.publishedYear,
    coverImageUrl: base.coverImageUrl ?? extra.coverImageUrl,
    description: base.description ?? extra.description,
    subjects: base.subjects?.length ? base.subjects : extra.subjects,
  }
}

/**
 * Resolves book metadata by ISBN across multiple free providers.
 *
 * Order: Open Library (strong for Western/English) → Google Books (free, no key,
 * much better Chinese/CJK coverage). Whichever hits first is the base; the other
 * fills any missing fields. Returns null only if NO provider has the book.
 *
 * Phase 2 note: a dedicated Chinese provider (e.g. tanshu/jisu, requires an API key)
 * can be added to this chain behind an env var once China hosting is in place.
 */
export async function lookupBookMetadata(isbn: string): Promise<BookMetadata | null> {
  // Run both in parallel; prefer whichever has the title, then merge the other in.
  const [ol, gb] = await Promise.all([
    lookupOpenLibrary(isbn).catch(() => null),
    lookupGoogleBooks(isbn).catch(() => null),
  ])

  let result: BookMetadata | null
  let resolvedBy: 'openLibrary+googleBooks' | 'openLibrary' | 'googleBooks' | 'none'

  if (ol && gb) {
    // Both found it — base on the one with richer text (description), fill from the other.
    const base = ol.description ? ol : gb
    const other = base === ol ? gb : ol
    result = merge(base, other)
    resolvedBy = 'openLibrary+googleBooks'
  } else if (ol) {
    result = ol
    resolvedBy = 'openLibrary'
  } else if (gb) {
    result = gb
    resolvedBy = 'googleBooks'
  } else {
    result = null
    resolvedBy = 'none'
  }

  // Structured log — visible via `wrangler tail` to debug coverage (esp. CJK ISBNs).
  console.log(
    JSON.stringify({
      event: 'isbn_lookup',
      isbn,
      resolvedBy,
      found: result !== null,
      title: result?.title,
    }),
  )

  return result
}
