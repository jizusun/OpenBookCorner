// Maps circulation error codes (thrown by services / server functions) to friendly,
// user-facing messages. Falls back to a generic message for anything unexpected.
const MESSAGES: Record<string, string> = {
  BOOK_NOT_FOUND: 'This book could not be found.',
  BOOK_NOT_IN_LIBRARY: 'This book is not in your library\u2019s catalog yet. Ask a librarian to add it.',
  BOOK_NOT_AVAILABLE: 'This book is currently borrowed by someone else.',
  BORROW_LIMIT_REACHED: "You've reached your borrowing limit. Return a book before borrowing another.",
  HAS_OVERDUE_BOOKS: 'You have an overdue book. Please return it before borrowing more.',
  INVALID_RETURN_REQUEST: 'We could not process this return. It may already be returned.',
  BOOK_CURRENTLY_BORROWED: 'This book is currently borrowed and cannot be changed until it is returned.',
}

export function circulationErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code]
  }
  if (raw.toLowerCase().includes('offline')) {
    return 'You appear to be offline. Connect to the internet and try again.'
  }
  return fallback
}
