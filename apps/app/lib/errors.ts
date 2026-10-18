import type { MessageKey } from '@/lib/i18n'
import type { TranslateFn } from '@/lib/i18n'

// Maps circulation error codes (thrown by tRPC procedures) to i18n message
// keys. tRPC wraps the thrown Error message in TRPCClientError, so matching by
// substring stays robust.
const CODE_TO_KEY: Record<string, MessageKey> = {
  BOOK_NOT_FOUND: 'error.bookNotFound',
  BOOK_NOT_IN_LIBRARY: 'error.bookNotInLibrary',
  BOOK_NOT_AVAILABLE: 'error.bookNotAvailable',
  BORROW_LIMIT_REACHED: 'error.borrowLimit',
  HAS_OVERDUE_BOOKS: 'error.hasOverdue',
  INVALID_RETURN_REQUEST: 'error.invalidReturn',
  BOOK_CURRENTLY_BORROWED: 'error.bookCurrentlyBorrowed',
}

/**
 * Resolve a circulation error into a localized, user-facing message.
 *
 * `t` is passed in (not called via a hook here) so this stays a plain function
 * usable from mutation callbacks. Falls back to a generic message, with a
 * dedicated message for genuine network/offline failures.
 */
export function circulationErrorMessage(err: unknown, t: TranslateFn): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  for (const code of Object.keys(CODE_TO_KEY)) {
    if (raw.includes(code)) return t(CODE_TO_KEY[code]!)
  }
  // Genuine network failures (fetch rejected, aborted, DNS, etc.).
  if (/offline|failed to fetch|load failed|networkerror|network request failed|aborted/i.test(raw)) {
    return t('error.offline')
  }
  return t('error.generic')
}
