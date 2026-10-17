/**
 * Persist book cover images to Cloudflare R2 so the catalog serves durable,
 * same-origin covers instead of hot-linking third-party URLs (which can rot,
 * rate-limit, or leak referrers). Served back via GET /covers/:key on the API.
 */

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Download `sourceUrl` and store it in R2. When an `isbn` is given the object
 * key is `cover-<normalizedISBN>.<ext>` (stable + addressable by ISBN); otherwise
 * it's content-addressed from the source URL. Returns a same-origin
 * `/covers/<key>` path, or `null` if the source can't be fetched — in which case
 * the caller should keep the original external URL.
 */
export async function storeCoverImage(
  r2: R2Bucket,
  sourceUrl: string | undefined | null,
  isbn?: string | null,
): Promise<string | null> {
  if (!sourceUrl) return null
  try {
    const normalizedIsbn = isbn?.replace(/[^0-9Xx]/g, '').toUpperCase()

    const res = await fetch(sourceUrl)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    const ext = EXT_BY_TYPE[contentType] ?? 'jpg'
    const key = normalizedIsbn
      ? `cover-${normalizedIsbn}.${ext}`
      : `${await sha256Hex(sourceUrl)}.${ext}`

    const body = await res.arrayBuffer()
    await r2.put(key, body, { httpMetadata: { contentType } })
    return `/covers/${key}`
  } catch {
    // Network / R2 failure: don't block the add — caller keeps the external URL.
    return null
  }
}
