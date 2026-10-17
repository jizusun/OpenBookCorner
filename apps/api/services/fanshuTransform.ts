/**
 * Pure transforms for the 番薯借阅 Excel export → OpenBookCorner rows.
 *
 * No I/O here (so it is trivially unit-testable): callers pass already-parsed
 * sheet rows (arrays of objects keyed by the Chinese headers) and a libraryId,
 * and get back typed rows ready to insert. EVERY source row is also preserved
 * verbatim in a `raw` JSON field, so no field is ever lost.
 */

export type Row = Record<string, unknown>

const ROLE_MAP: Record<string, 'library_admin' | 'library_reader'> = {
  馆长: 'library_admin',
  管理员: 'library_admin',
  普通成员: 'library_reader',
}

const s = (v: unknown): string => (v == null ? '' : String(v)).trim()
const orNull = (v: unknown): string | null => {
  const t = s(v)
  return t === '' ? null : t
}
const numOrNull = (v: unknown): number | null => {
  const t = s(v)
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Normalize a 番薯 date to ISO. Handles 'YYYY-MM-DD[ HH:mm:ss]' strings and
 * Excel serial numbers (used in 评论创建时间). Returns null on empty/invalid.
 */
export function toIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    // Excel serial date → JS. Excel epoch 1899-12-30 (accounts for the 1900 bug).
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const str = s(v).replace(' ', 'T')
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export interface TransformInput {
  libraryId: string
  books: Row[] // 书籍清单
  stock: Row[] // 存量明细
  members: Row[] // 成员清单
  loans: Row[] // 借阅清单
  reviews: Row[] // 评论清单
  purchaseRequests: Row[] // 荐购清单
  now?: () => string
  id?: (prefix: string, key: string) => string
}

// Deterministic id so re-imports are idempotent (same source row → same id).
// Uses a hash of the FULL key — NOT a prefix slice. Slicing the key to N chars
// collides when keys share a long common prefix (e.g. UUID libraryId + memberId),
// which would make different loans upsert onto the same row. FNV-1a (64-bit,
// rendered hex) over the whole key avoids that with no dependencies.
function fnv1a64(str: string): string {
  // 64-bit FNV-1a using BigInt for correctness across long keys.
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

function defaultId(prefix: string, key: string): string {
  return `${prefix}_${fnv1a64(key)}`
}

export function transformBooks(input: TransformInput) {
  const { libraryId, books, stock } = input
  const id = input.id ?? defaultId
  const nowIso = (input.now ?? (() => new Date().toISOString()))()

  const stockByIsbn = new Map<string, Row>()
  for (const row of stock) stockByIsbn.set(s(row['ISBN']), row)

  const byIsbn = new Map<string, ReturnType<typeof buildBook>>()
  const rowCount = new Map<string, number>()

  function buildBook(isbn: string, b: Row) {
    const st = stockByIsbn.get(isbn)
    const quantity = st ? Number(st['书籍总量'] ?? 1) || 1 : 1
    const availableCount = st ? Number(st['在架数量'] ?? quantity) : quantity
    return {
      id: id('book', `${libraryId}:${isbn}`),
      isbn,
      title: s(b['标题']) || isbn,
      author: s(b['作者']) || '',
      publisher: orNull(b['出版社']),
      coverImageUrl: null as string | null,
      description: null as string | null,
      subjects: null as string[] | null,
      libraryId,
      quantity,
      availableCount,
      isAvailable: availableCount > 0,
      copyCode: orNull(b['馆内编码']),
      category: orNull(b['所属分类']),
      shelfLocation: orNull(b['所属书架']),
      translator: orNull(b['译者']),
      series: orNull(b['系列']),
      pageCount: numOrNull(b['页数']),
      price: orNull(b['价格']),
      priceUnit: orNull(b['价格单位']),
      cnLibraryClass: orNull(b['中图法分类号']),
      enteredAt: toIso(b['录入时间']),
      isShelved: s(b['已上架']) === '' ? null : s(b['已上架']) === '是',
      publishedDate: orNull(b['出版时间']),
      publishedYear: ((): number | null => {
        const d = s(b['出版时间'])
        const m = d.match(/^(\d{4})/)
        return m ? Number(m[1]) : null
      })(),
      wordCount: numOrNull(b['字数']),
      source: 'fanshu-import',
      // Preserve EVERY contributing source row (all physical copies for this
      // ISBN + the stock row), so no per-copy field (馆内编码/所属书架/…) is lost
      // when we dedupe by ISBN.
      raw: { books: [b] as Row[], stock: st ?? null } as Record<string, unknown>,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  }

  for (const b of books) {
    const isbn = s(b['ISBN'])
    if (!isbn) continue
    rowCount.set(isbn, (rowCount.get(isbn) ?? 0) + 1)
    const existing = byIsbn.get(isbn)
    if (!existing) {
      byIsbn.set(isbn, buildBook(isbn, b))
    } else {
      // Additional physical copy of the same ISBN — keep its full row in raw.
      ;(existing.raw as { books: Row[] }).books.push(b)
    }
  }
  // If 存量明细 was missing for an ISBN, fall back quantity to the row count.
  for (const [isbn, book] of byIsbn) {
    if (!stockByIsbn.has(isbn)) {
      const q = rowCount.get(isbn) ?? 1
      book.quantity = q
      book.availableCount = q
      book.isAvailable = q > 0
    }
  }
  return [...byIsbn.values()]
}

export function transformMembers(input: TransformInput) {
  const { libraryId, members } = input
  const id = input.id ?? defaultId
  const nowIso = (input.now ?? (() => new Date().toISOString()))()

  let placeholderN = 0
  return members.map((m, i) => {
    const rawName = s(m['姓名'])
    const isPlaceholder = rawName === '' || rawName === '微信用户'
    if (isPlaceholder) placeholderN++
    const name = isPlaceholder ? `Unknown #${placeholderN}` : rawName
    const memberNo = orNull(m['会员号'])
    // stable id: prefer 会员号, else name+phone+index to avoid collisions
    const key = memberNo ?? `${rawName}:${s(m['手机'])}:${i}`
    return {
      id: id('member', `${libraryId}:${key}`),
      libraryId,
      name,
      role: ROLE_MAP[s(m['成员权限'])] ?? 'library_reader',
      phone: orNull(m['手机']),
      email: orNull(m['邮箱']),
      memberNo,
      employeeNo: orNull(m['工号']),
      studentNo: orNull(m['学号']),
      className: orNull(m['班级']),
      department: orNull(m['部门']),
      note: [orNull(m['备注1']), orNull(m['备注2'])].filter(Boolean).join(' | ') || null,
      joinedAt: toIso(m['入馆日期']),
      membershipPlan: orNull(m['会员计划']),
      memberStart: toIso(m['会员起始日期']),
      memberExpiry: toIso(m['会员到期日期']),
      borrowedCount: numOrNull(m['在借数量']),
      returnedCount: numOrNull(m['已还数量']),
      address: orNull(m['地址']),
      roomNo: orNull(m['房号']),
      age: numOrNull(m['年龄']),
      isPlaceholder,
      userId: null as string | null,
      source: 'fanshu-import',
      raw: m as Record<string, unknown>,
      createdAt: nowIso,
    }
  })
}

export interface LoanResult {
  loans: Array<{
    id: string
    bookId: string
    userId: null
    memberId: string
    libraryId: string
    borrowedAt: string
    dueDate: string
    returnedAt: string | null
    source: string
    raw: Record<string, unknown>
  }>
  orphans: { noMember: number; noBook: number }
}

export function transformLoans(
  input: TransformInput,
  memberIdByName: Map<string, string>,
  bookIdByIsbn: Map<string, string>,
): LoanResult {
  const { libraryId, loans } = input
  const id = input.id ?? defaultId
  const out: LoanResult = { loans: [], orphans: { noMember: 0, noBook: 0 } }

  for (const l of loans) {
    const memberName = s(l['成员名称'])
    const isbn = s(l['书籍ISBN'])
    const memberId = memberIdByName.get(memberName)
    const bookId = bookIdByIsbn.get(isbn)
    if (!memberId) {
      out.orphans.noMember++
      continue
    }
    if (!bookId) {
      out.orphans.noBook++
      continue
    }
    const borrowedAt = toIso(l['借书日期'])
    const dueDate = toIso(l['应还日期'])
    const returnedAt = toIso(l['还书日期'])
    if (!borrowedAt || !dueDate) continue
    out.loans.push({
      id: id('loan', `${libraryId}:${memberId}:${isbn}:${borrowedAt}`),
      bookId,
      userId: null,
      memberId,
      libraryId,
      borrowedAt,
      dueDate,
      returnedAt,
      source: 'fanshu-import',
      raw: l as Record<string, unknown>,
    })
  }
  return out
}

export function transformReviews(input: TransformInput) {
  const { libraryId, reviews } = input
  const id = input.id ?? defaultId
  const nowIso = (input.now ?? (() => new Date().toISOString()))()
  return reviews
    .filter((r) => s(r['评论']) !== '')
    .map((r, i) => ({
      id: id('review', `${libraryId}:${s(r['ISBN'])}:${i}`),
      libraryId,
      isbn: orNull(r['ISBN']),
      bookTitle: orNull(r['书名']),
      memberName: orNull(r['用户馆内名称']),
      nickname: orNull(r['用户昵称']),
      body: s(r['评论']),
      reviewedAt: toIso(r['评论创建时间']),
      source: 'fanshu-import',
      raw: r as Record<string, unknown>,
      createdAt: nowIso,
    }))
}

export function transformPurchaseRequests(input: TransformInput) {
  const { libraryId, purchaseRequests } = input
  const id = input.id ?? defaultId
  const nowIso = (input.now ?? (() => new Date().toISOString()))()
  return purchaseRequests.map((p, i) => ({
    id: id('rec', `${libraryId}:${s(p['ISBN'])}:${i}`),
    libraryId,
    isbn: orNull(p['ISBN']),
    title: s(p['书名']) || s(p['ISBN']) || `rec-${i}`,
    author: orNull(p['作者']),
    publisher: orNull(p['出版社']),
    requesterCount: numOrNull(p['荐购人数']) ?? 1,
    requesters: orNull(p['荐购人']),
    source: 'fanshu-import',
    raw: p as Record<string, unknown>,
    createdAt: nowIso,
  }))
}
