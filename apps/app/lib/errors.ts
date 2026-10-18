import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'

// Maps circulation error codes (thrown by tRPC procedures) to Lingui message
// descriptors (created with the `msg` macro so they're extracted into the
// catalogs). tRPC wraps the thrown Error message in TRPCClientError, so matching
// by substring stays robust.
const CODE_TO_MESSAGE: Record<string, MessageDescriptor> = {
  BOOK_NOT_FOUND: msg`This book could not be found.`,
  BOOK_NOT_IN_LIBRARY: msg`This book is not in your library’s catalog yet. Ask a librarian to add it.`,
  BOOK_NOT_AVAILABLE: msg`This book is currently borrowed by someone else.`,
  BORROW_LIMIT_REACHED: msg`You've reached your borrowing limit. Return a book before borrowing another.`,
  HAS_OVERDUE_BOOKS: msg`You have an overdue book. Please return it before borrowing more.`,
  INVALID_RETURN_REQUEST: msg`We could not process this return. It may already be returned.`,
  BOOK_CURRENTLY_BORROWED: msg`This book is currently borrowed and cannot be changed until it is returned.`,
}

const OFFLINE = msg`You appear to be offline. Connect to the internet and try again.`
const GENERIC = msg`Something went wrong. Please try again.`

/**
 * Resolve a circulation error into a localized, user-facing message.
 *
 * A plain function (no hook) usable from mutation callbacks: it renders message
 * descriptors against the active `i18n`. Falls back to a generic message, with a
 * dedicated message for genuine network/offline failures.
 */
export function circulationErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  for (const code of Object.keys(CODE_TO_MESSAGE)) {
    if (raw.includes(code)) return i18n._(CODE_TO_MESSAGE[code]!)
  }
  // Genuine network failures (fetch rejected, aborted, DNS, etc.).
  if (/offline|failed to fetch|load failed|networkerror|network request failed|aborted/i.test(raw)) {
    return i18n._(OFFLINE)
  }
  return i18n._(GENERIC)
}
