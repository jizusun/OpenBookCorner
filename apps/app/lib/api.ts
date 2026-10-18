import type { Api } from '@obc/api'
import { queryOptions } from '@tanstack/react-query'
import { hc } from 'hono/client'
import type { InferResponseType } from 'hono/client'

import { queryClient } from './query'

/**
 * Typed Hono RPC client (hc). Same-origin; cookies included so Better Auth
 * sessions ride along. The API is mounted at /api on the Worker, so the client
 * is rooted there. All request inputs AND response types are inferred from the
 * server's `Api` type — true end-to-end type safety.
 */
export const client = hc<Api>('/api', { init: { credentials: 'include' } })

/**
 * Await a hono client call, check status, and return the JSON body typed by the
 * caller via `InferResponseType<fn, 200>` (the success branch). We throw on a
 * non-ok response, so the resolved value is always the 200 body.
 */
async function json<T>(call: Promise<ResponseLike>): Promise<T> {
  const res = await call
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await (res as unknown as Response).clone().json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // non-JSON error body; keep the status message
    }
    const err = new Error(message) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

type ResponseLike = { ok: boolean; status: number; json: () => Promise<unknown> }
/** Success (200) body type of a hc endpoint caller. */
type Ok<F extends (...a: never[]) => unknown> = InferResponseType<F, 200>

/** Drop undefined/null and stringify remaining values for a query record. */
function q(input: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && v !== null) out[k] = String(v)
  }
  return out
}

/**
 * Raw, fully-typed callers over the hc client. Return types are INFERRED from
 * the server — no hand-written shapes. These power the proxy below.
 */
const call = {
  'auth.me': () => json<Ok<typeof client.session.me.$get>>(client.session.me.$get()),
  'auth.requireMe': () =>
    json<Ok<(typeof client.session)['require-me']['$get']>>(client.session['require-me'].$get()),
  'book.list': (i: BookListInput = {}) =>
    json<Ok<typeof client.book.$get>>(client.book.$get({ query: q(i) })),
  'book.facets': () => json<Ok<typeof client.book.facets.$get>>(client.book.facets.$get()),
  'book.get': (i: { bookId: string }) =>
    json<Ok<(typeof client.book)[':bookId']['$get']>>(client.book[':bookId'].$get({ param: i })),
  'book.borrower': (i: { bookId: string }) =>
    json<Ok<(typeof client.book)[':bookId']['borrower']['$get']>>(
      client.book[':bookId'].borrower.$get({ param: i }),
    ),
  'book.add': (i: BookAddInput) => json<Ok<typeof client.book.$post>>(client.book.$post({ json: i })),
  'book.update': (i: BookUpdateInput) => {
    const { bookId, ...rest } = i
    return json<Ok<(typeof client.book)[':bookId']['$patch']>>(
      client.book[':bookId'].$patch({ param: { bookId }, json: rest }),
    )
  },
  'book.remove': (i: { bookId: string }) =>
    json<Ok<(typeof client.book)[':bookId']['$delete']>>(client.book[':bookId'].$delete({ param: i })),
  'book.lookupIsbn': (i: { isbn: string }) =>
    json<Ok<(typeof client.book.lookup)[':isbn']['$get']>>(
      client.book.lookup[':isbn'].$get({ param: i }),
    ),
  'borrowing.borrow': (i: { bookId: string }) =>
    json<Ok<typeof client.borrowing.borrow.$post>>(client.borrowing.borrow.$post({ json: i })),
  'borrowing.borrowByIsbn': (i: { isbn: string }) =>
    json<Ok<(typeof client.borrowing)['borrow-by-isbn']['$post']>>(
      client.borrowing['borrow-by-isbn'].$post({ json: i }),
    ),
  'borrowing.return': (i: { transactionId: string }) =>
    json<Ok<typeof client.borrowing.return.$post>>(client.borrowing.return.$post({ json: i })),
  'borrowing.myBooks': () =>
    json<Ok<(typeof client.borrowing)['my-books']['$get']>>(client.borrowing['my-books'].$get()),
  'borrowing.listOverdue': (i: { range?: OverdueRange } = {}) =>
    json<Ok<typeof client.borrowing.overdue.$get>>(client.borrowing.overdue.$get({ query: q(i) })),
  'library.settings': () =>
    json<Ok<typeof client.library.settings.$get>>(client.library.settings.$get()),
  'library.updateSettings': (i: UpdateSettingsInput) =>
    json<Ok<typeof client.library.settings.$put>>(client.library.settings.$put({ json: i })),
  'library.importFanshuPreview': (i: ImportBody) =>
    json<Ok<typeof client.library.import.preview.$post>>(
      client.library.import.preview.$post({ json: i }),
    ),
  'library.importFanshu': (i: ImportBody & { fileName?: string }) =>
    json<Ok<typeof client.library.import.$post>>(client.library.import.$post({ json: i })),
  'library.importFanshuFromUrl': (i: { url: string; preview?: boolean }) =>
    json<Ok<typeof client.library.import.url.$post>>(client.library.import.url.$post({ json: i })),
  'library.importHistory': () =>
    json<Ok<typeof client.library.import.history.$get>>(client.library.import.history.$get()),
  'member.list': (i: MemberListInput = {}) =>
    json<Ok<typeof client.member.$get>>(client.member.$get({ query: q(i) })),
  'member.facets': () => json<Ok<typeof client.member.facets.$get>>(client.member.facets.$get()),
  'member.get': (i: { memberId: string }) =>
    json<Ok<(typeof client.member)[':memberId']['$get']>>(
      client.member[':memberId'].$get({ param: i }),
    ),
  'feedback.submit': (i: FeedbackInput) =>
    json<Ok<typeof client.feedback.$post>>(client.feedback.$post({ json: i })),
  'feedback.list': () => json<Ok<typeof client.feedback.$get>>(client.feedback.$get()),
  'tenant.list': () => json<Ok<typeof client.tenant.$get>>(client.tenant.$get()),
  'tenant.create': (i: { name: string; emailDomains: string[] }) =>
    json<Ok<typeof client.tenant.$post>>(client.tenant.$post({ json: i })),
  'tenant.setActive': (i: { libraryId: string; isActive: boolean }) =>
    json<Ok<(typeof client.tenant)['set-active']['$post']>>(
      client.tenant['set-active'].$post({ json: i }),
    ),
}

type Endpoint = keyof typeof call
type Input<E extends Endpoint> = Parameters<(typeof call)[E]>[0]
type Output<E extends Endpoint> = Awaited<ReturnType<(typeof call)[E]>>

function node<E extends Endpoint>(key: E) {
  const scope = key.split('.')
  const run = call[key] as (i?: Input<E>) => Promise<Output<E>>
  return {
    query: (input?: Input<E>) => run(input),
    mutate: (input?: Input<E>) => run(input),
    queryKey: (input?: Input<E>) => (input === undefined ? scope : [...scope, input]),
    queryOptions: (input?: Input<E>) =>
      queryOptions({
        queryKey: input === undefined ? scope : [...scope, input],
        queryFn: () => run(input),
      }),
    mutationOptions: () => ({ mutationFn: (input: Input<E>) => run(input) }),
  }
}

/**
 * tRPC-proxy-shaped API over the typed hc client. Route components keep calling
 * `api.book.list.queryOptions(input)` / `.mutationOptions()` / `.queryKey()` /
 * `.query()`, with the same TanStack Query keys as before. Response types are
 * inferred from the server, so field access stays type-checked end to end.
 */
export const api = {
  auth: { me: node('auth.me'), requireMe: node('auth.requireMe') },
  book: {
    list: node('book.list'),
    facets: node('book.facets'),
    get: node('book.get'),
    borrower: node('book.borrower'),
    add: node('book.add'),
    update: node('book.update'),
    remove: node('book.remove'),
    lookupIsbn: node('book.lookupIsbn'),
  },
  borrowing: {
    borrow: node('borrowing.borrow'),
    borrowByIsbn: node('borrowing.borrowByIsbn'),
    return: node('borrowing.return'),
    myBooks: node('borrowing.myBooks'),
    listOverdue: node('borrowing.listOverdue'),
  },
  library: {
    settings: node('library.settings'),
    updateSettings: node('library.updateSettings'),
    importFanshuPreview: node('library.importFanshuPreview'),
    importFanshu: node('library.importFanshu'),
    importFanshuFromUrl: node('library.importFanshuFromUrl'),
    importHistory: node('library.importHistory'),
  },
  member: { list: node('member.list'), facets: node('member.facets'), get: node('member.get') },
  feedback: { submit: node('feedback.submit'), list: node('feedback.list') },
  tenant: {
    list: node('tenant.list'),
    create: node('tenant.create'),
    setActive: node('tenant.setActive'),
  },
}

/** Cached current-user resolver for route guards (unchanged behavior). */
export function ensureRequireMe() {
  return queryClient.ensureQueryData(api.auth.requireMe.queryOptions())
}

// Only the request-input shapes are declared (the server infers outputs). These
// mirror the server Zod schemas so call sites pass the right arguments.
type BookListInput = {
  search?: string
  page?: number
  limit?: number
  sortBy?: 'enteredAt' | 'title' | 'author' | 'available' | 'price'
  sortDir?: 'asc' | 'desc'
  category?: string
  shelf?: string
  availability?: 'all' | 'available' | 'borrowed'
}
type BookAddInput = {
  isbn: string
  title: string
  author: string
  publisher?: string
  publishedYear?: number
  coverImageUrl?: string
  description?: string
  subjects?: string[]
  quantity?: number
}
type BookUpdateInput = {
  bookId: string
  title: string
  author: string
  isbn: string
  publisher?: string
  publishedYear?: number
  description?: string
}
type OverdueRange = '1-7' | '8-14' | '15+' | 'all'
type UpdateSettingsInput = {
  name: string
  borrowingPeriodDays: number
  maxBooksPerReader: number
  allowExtensions: boolean
}
type Sheet = Array<Record<string, unknown>>
type ImportBody = {
  sheets: {
    books: Sheet
    stock: Sheet
    members: Sheet
    loans: Sheet
    reviews: Sheet
    purchaseRequests: Sheet
  }
}
type MemberListInput = {
  search?: string
  page?: number
  limit?: number
  sortBy?: 'name' | 'joinedAt' | 'borrowedCount' | 'memberExpiry'
  sortDir?: 'asc' | 'desc'
  role?: 'library_admin' | 'library_reader'
  plan?: string
}
type FeedbackInput = {
  category: 'feature_request' | 'bug' | 'book_suggestion' | 'other'
  message: string
}
