import { describe, it, expect } from 'vitest'

import {
  toIso,
  transformBooks,
  transformLoans,
  transformMembers,
  transformPurchaseRequests,
  transformReviews,
  type TransformInput,
} from './fanshuTransform'

const LIB = 'lib-x'

function input(partial: Partial<TransformInput>): TransformInput {
  return {
    libraryId: LIB,
    books: [],
    stock: [],
    members: [],
    loans: [],
    reviews: [],
    purchaseRequests: [],
    now: () => '2025-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('fanshu transforms', () => {
  it('toIso handles 番薯 date strings and Excel serials', () => {
    expect(toIso('2023-09-12')).toBe('2023-09-12T00:00:00.000Z')
    expect(toIso('2020-07-09 17:45:08')).toMatch(/^2020-07-09T/)
    expect(toIso('')).toBeNull()
    // Excel serial 45609 ≈ 2024-11-xx; just assert it parses to an ISO string.
    expect(toIso(45609)).toMatch(/^20\d\d-\d\d-\d\dT/)
  })

  it('dedupes books by ISBN and pulls quantity/available from 存量明细', () => {
    const books = [
      { 标题: 'A', 作者: 'x', ISBN: '111', 页数: '100', 价格: '10', 价格单位: 'CNY', 所属书架: 'S1' },
      { 标题: 'A copy 2', 作者: 'x', ISBN: '111' }, // duplicate ISBN = second copy
      { 标题: 'B', 作者: 'y', ISBN: '222' },
    ]
    const stock = [
      { ISBN: '111', 书籍总量: 2, 在架数量: 1 },
      { ISBN: '222', 书籍总量: 1, 在架数量: 0 },
    ]
    const out = transformBooks(input({ books, stock }))
    expect(out).toHaveLength(2) // deduped
    const a = out.find((b) => b.isbn === '111')!
    expect(a.quantity).toBe(2)
    expect(a.availableCount).toBe(1)
    expect(a.isAvailable).toBe(true)
    expect(a.shelfLocation).toBe('S1')
    expect(a.pageCount).toBe(100)
    expect(a.price).toBe('10')
    expect(a.priceUnit).toBe('CNY')
    // raw preserves EVERY contributing source row (both copies of ISBN 111 +
    // the stock row) — zero data loss when deduping by ISBN.
    const aRaw = a.raw as { books: Record<string, unknown>[]; stock: Record<string, unknown> | null }
    expect(aRaw.books).toHaveLength(2)
    expect(aRaw.books[0]).toMatchObject({ 标题: 'A', ISBN: '111' })
    expect(aRaw.books[1]).toMatchObject({ 标题: 'A copy 2', ISBN: '111' })
    expect(aRaw.stock).toMatchObject({ ISBN: '111', 书籍总量: 2 })
    const b = out.find((x) => x.isbn === '222')!
    expect(b.availableCount).toBe(0)
    expect(b.isAvailable).toBe(false)
  })

  it('maps member roles and labels placeholders without dropping rows', () => {
    const members = [
      { 姓名: 'Mia', 成员权限: '馆长', 手机: '123', 会员号: 'I1' },
      { 姓名: 'Bob', 成员权限: '普通成员' },
      { 姓名: '', 成员权限: '普通成员' }, // blank → placeholder
      { 姓名: '微信用户', 成员权限: '普通成员' }, // wechat → placeholder
    ]
    const out = transformMembers(input({ members }))
    expect(out).toHaveLength(4) // ALL members kept
    expect(out[0]).toMatchObject({ name: 'Mia', role: 'library_admin', phone: '123', memberNo: 'I1' })
    expect(out[1]).toMatchObject({ name: 'Bob', role: 'library_reader' })
    expect(out[2].isPlaceholder).toBe(true)
    expect(out[2].name).toBe('Unknown #1')
    expect(out[3].isPlaceholder).toBe(true)
    expect(out[3].name).toBe('Unknown #2')
    expect(out[0].raw).toMatchObject({ 姓名: 'Mia' })
  })

  it('joins loans to members (by name) and books (by ISBN); flags orphans; sets returnedAt', () => {
    const members = [{ 姓名: 'Mia', 成员权限: '馆长' }]
    const books = [{ 标题: 'A', 作者: 'x', ISBN: '111' }]
    const stock = [{ ISBN: '111', 书籍总量: 1, 在架数量: 0 }]
    const loans = [
      { 成员名称: 'Mia', 书籍ISBN: '111', 借阅状态: '借阅中', 借书日期: '2023-01-01', 应还日期: '2023-02-01', 还书日期: '' },
      { 成员名称: 'Mia', 书籍ISBN: '111', 借阅状态: '已归还', 借书日期: '2022-01-01', 应还日期: '2022-02-01', 还书日期: '2022-01-20' },
      { 成员名称: 'Ghost', 书籍ISBN: '111', 借书日期: '2023-01-01', 应还日期: '2023-02-01' }, // no member
      { 成员名称: 'Mia', 书籍ISBN: '999', 借书日期: '2023-01-01', 应还日期: '2023-02-01' }, // no book
    ]
    const inp = input({ members, books, stock, loans })
    const m = transformMembers(inp)
    const b = transformBooks(inp)
    const memberIdByName = new Map(m.map((x) => [String((x.raw as Record<string, unknown>)['姓名']), x.id]))
    const bookIdByIsbn = new Map(b.map((x) => [x.isbn, x.id]))
    const { loans: out, orphans } = transformLoans(inp, memberIdByName, bookIdByIsbn)
    expect(out).toHaveLength(2)
    expect(orphans).toEqual({ noMember: 1, noBook: 1 })
    expect(out[0].returnedAt).toBeNull() // active
    expect(out[1].returnedAt).toMatch(/^2022-01-20T/) // returned
    expect(out[0].userId).toBeNull()
    expect(out[0].memberId).toBe(m[0].id)
  })

  it('transforms reviews (skips empty) and purchase requests, preserving raw', () => {
    const reviews = [
      { 书名: 'A', ISBN: '111', 用户馆内名称: 'Molly', 用户昵称: '微信用户', 评论: 'good', 评论创建时间: 45609 },
      { 书名: 'B', ISBN: '222', 评论: '' }, // empty → skipped
    ]
    const recs = [{ 书名: 'C', ISBN: '333', 作者: 'z', 荐购人数: 2, 荐购人: 'Michelle' }]
    const r = transformReviews(input({ reviews }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ body: 'good', nickname: '微信用户' })
    expect(r[0].reviewedAt).toMatch(/^20\d\d-/)
    const p = transformPurchaseRequests(input({ purchaseRequests: recs }))
    expect(p[0]).toMatchObject({ title: 'C', requesterCount: 2, requesters: 'Michelle' })
    expect(p[0].raw).toMatchObject({ 书名: 'C' })
  })

  it('produces deterministic ids (idempotent re-import)', () => {
    const members = [{ 姓名: 'Mia', 成员权限: '馆长', 会员号: 'I1' }]
    const a = transformMembers(input({ members }))[0]
    const b = transformMembers(input({ members }))[0]
    expect(a.id).toBe(b.id)
  })

  it('loan ids do not collide when keys share a long UUID prefix (regression)', () => {
    // library + member ids are UUIDs → keys share a long common prefix. A
    // prefix-slice id would collide; a full-key hash must not.
    const LIB = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    const members = [
      { 姓名: 'A', 成员权限: '普通成员', 会员号: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      { 姓名: 'B', 成员权限: '普通成员', 会员号: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
    ]
    const books = [
      { 标题: 'X', 作者: 'x', ISBN: '111' },
      { 标题: 'Y', 作者: 'y', ISBN: '222' },
    ]
    const loans = [
      { 成员名称: 'A', 书籍ISBN: '111', 借书日期: '2023-01-01', 应还日期: '2023-02-01' },
      { 成员名称: 'B', 书籍ISBN: '222', 借书日期: '2023-03-01', 应还日期: '2023-04-01' },
      { 成员名称: 'A', 书籍ISBN: '111', 借书日期: '2023-05-01', 应还日期: '2023-06-01' },
    ]
    const inp = input({ libraryId: LIB, members, books, loans })
    const m = transformMembers(inp)
    const b = transformBooks(inp)
    const memberIdByName = new Map(m.map((x) => [String((x.raw as Record<string, unknown>)['姓名']), x.id]))
    const bookIdByIsbn = new Map(b.map((x) => [x.isbn, x.id]))
    const { loans: out } = transformLoans(inp, memberIdByName, bookIdByIsbn)
    const ids = out.map((l) => l.id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3) // all distinct — no collisions
  })
})
