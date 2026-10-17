import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedLibrary, type Db } from '@obc/db/testing'
import { eq } from 'drizzle-orm'
import { books, members, borrowTransactions, reviews, purchaseRequests } from '@obc/db'

import { FanshuImportService, previewFanshuImport, type FanshuSheets } from './fanshuImport'

const LIB = 'lib-sap'

const sheets: FanshuSheets = {
  books: [
    { 标题: 'A', 作者: 'x', ISBN: '111', 所属书架: 'S1', 页数: '100' },
    { 标题: 'A2', 作者: 'x', ISBN: '111' },
    { 标题: 'B', 作者: 'y', ISBN: '222' },
  ],
  stock: [
    { ISBN: '111', 书籍总量: 2, 在架数量: 1 },
    { ISBN: '222', 书籍总量: 1, 在架数量: 0 },
  ],
  members: [
    { 姓名: 'Mia', 成员权限: '馆长', 会员号: 'I1' },
    { 姓名: '', 成员权限: '普通成员' },
  ],
  loans: [
    { 成员名称: 'Mia', 书籍ISBN: '222', 借阅状态: '借阅中', 借书日期: '2023-01-01', 应还日期: '2023-02-01', 还书日期: '' },
  ],
  reviews: [{ 书名: 'A', ISBN: '111', 用户馆内名称: 'Mia', 评论: 'nice', 评论创建时间: '2024-01-01' }],
  purchaseRequests: [{ 书名: 'C', ISBN: '333', 荐购人数: 1, 荐购人: 'Mia' }],
}

describe('FanshuImportService', () => {
  let db: Db
  beforeEach(async () => {
    db = await createTestDb()
    await seedLibrary(db, LIB)
  })

  it('preview counts match without writing', async () => {
    const c = previewFanshuImport(LIB, sheets)
    expect(c.books).toBe(2) // deduped by ISBN
    expect(c.members).toBe(2)
    expect(c.loans).toBe(1)
    expect(c.reviews).toBe(1)
    expect(c.purchaseRequests).toBe(1)
    // nothing written
    expect((await db.select().from(books)).length).toBe(0)
  })

  it('imports all entities with zero data loss (raw preserved) and correct links', async () => {
    const c = await new FanshuImportService(db).import(LIB, sheets)
    expect(c).toMatchObject({ books: 2, members: 2, loans: 1, reviews: 1, purchaseRequests: 1 })

    const bookRows = await db.select().from(books).where(eq(books.libraryId, LIB))
    expect(bookRows).toHaveLength(2)
    const b222 = bookRows.find((b) => b.isbn === '222')!
    expect(b222.quantity).toBe(1)
    expect(b222.availableCount).toBe(0)
    expect(b222.isAvailable).toBe(false)
    const b111 = bookRows.find((b) => b.isbn === '111')!
    expect(b111.shelfLocation).toBe('S1')
    expect(b111.raw).toMatchObject({ 标题: 'A', ISBN: '111' }) // zero data loss

    const memberRows = await db.select().from(members).where(eq(members.libraryId, LIB))
    expect(memberRows).toHaveLength(2)
    expect(memberRows.some((m) => m.isPlaceholder && m.name === 'Unknown #1')).toBe(true)

    const loanRows = await db.select().from(borrowTransactions).where(eq(borrowTransactions.libraryId, LIB))
    expect(loanRows).toHaveLength(1)
    expect(loanRows[0].userId).toBeNull()
    expect(loanRows[0].memberId).toBe(memberRows.find((m) => m.name === 'Mia')!.id)
    expect(loanRows[0].returnedAt).toBeNull()

    expect((await db.select().from(reviews).where(eq(reviews.libraryId, LIB)))).toHaveLength(1)
    expect((await db.select().from(purchaseRequests).where(eq(purchaseRequests.libraryId, LIB)))).toHaveLength(1)
  })

  it('is idempotent — re-import does not duplicate', async () => {
    const svc = new FanshuImportService(db)
    await svc.import(LIB, sheets)
    await svc.import(LIB, sheets)
    expect((await db.select().from(books).where(eq(books.libraryId, LIB)))).toHaveLength(2)
    expect((await db.select().from(members).where(eq(members.libraryId, LIB)))).toHaveLength(2)
    expect((await db.select().from(borrowTransactions).where(eq(borrowTransactions.libraryId, LIB)))).toHaveLength(1)
  })
})
