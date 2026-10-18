import { TRPCError } from '@trpc/server'

/**
 * Stable, machine-readable domain error codes thrown by the service layer.
 * The SPA's `circulationErrorMessage` matches on these exact strings, so the
 * code string IS the contract — keep it in sync with `apps/app/lib/errors.ts`.
 */
export type DomainErrorCode =
  | 'BOOK_NOT_FOUND'
  | 'BOOK_NOT_AVAILABLE'
  | 'BOOK_NOT_IN_LIBRARY'
  | 'BOOK_CURRENTLY_BORROWED'
  | 'BORROW_LIMIT_REACHED'
  | 'HAS_OVERDUE_BOOKS'
  | 'INVALID_RETURN_REQUEST'
  | 'LIBRARY_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'

/** Which tRPC error code each domain code surfaces as. Defaults to BAD_REQUEST. */
const TRPC_CODE_BY_DOMAIN: Partial<Record<DomainErrorCode, TRPCError['code']>> = {
  BOOK_NOT_FOUND: 'NOT_FOUND',
  BOOK_NOT_IN_LIBRARY: 'NOT_FOUND',
  LIBRARY_NOT_FOUND: 'NOT_FOUND',
  MEMBER_NOT_FOUND: 'NOT_FOUND',
  BOOK_CURRENTLY_BORROWED: 'CONFLICT',
  BOOK_NOT_AVAILABLE: 'CONFLICT',
  BORROW_LIMIT_REACHED: 'CONFLICT',
  HAS_OVERDUE_BOOKS: 'CONFLICT',
  INVALID_RETURN_REQUEST: 'CONFLICT',
}

/**
 * A business-rule failure raised by services. Carries a stable `code` so the
 * transport layer can map it to a typed `TRPCError` consistently, and the
 * client can match on it.
 */
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode) {
    super(code)
    this.name = 'DomainError'
  }
}

/**
 * Map a thrown service error to a `TRPCError`. `DomainError` becomes a typed
 * tRPC error with the mapped code and the stable code string as its message
 * (so the SPA keeps matching). Anything else is rethrown unchanged.
 */
export function toTRPCError(err: unknown): never {
  if (err instanceof DomainError) {
    throw new TRPCError({
      code: TRPC_CODE_BY_DOMAIN[err.code] ?? 'BAD_REQUEST',
      message: err.code,
    })
  }
  throw err
}

/** Run a service call, normalizing any `DomainError` into a `TRPCError`. */
export async function mapDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    toTRPCError(err)
  }
}
