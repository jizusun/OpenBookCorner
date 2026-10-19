import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from './auth'

/**
 * Multi-tenant domain tables. Every tenant-scoped table carries `libraryId`.
 * ALL queries MUST filter by it (enforced in tRPC middleware + services).
 */

export interface LibrarySettings {
  borrowingPeriodDays: number // default 14
  maxBooksPerReader: number // default 5
  allowExtensions: boolean // default false
}

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emailDomains: text('email_domains', { mode: 'json' }).$type<string[]>().notNull(),
  settings: text('settings', { mode: 'json' }).$type<LibrarySettings>().notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // Per-tenant subdomain + branding (ADR 0003). `slug` is the subdomain label
  // (unique); branding fields feed the pre-auth customized login page.
  slug: text('slug').unique(),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color'),
  loginWelcome: text('login_welcome'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  isbn: text('isbn').notNull(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  publisher: text('publisher'),
  publishedYear: integer('published_year'),
  coverImageUrl: text('cover_image_url'),
  description: text('description'),
  subjects: text('subjects', { mode: 'json' }).$type<string[]>(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  // Multiple copies (B3). quantity = total copies; availableCount = how many are
  // currently on the shelf. isAvailable is kept as a derived convenience
  // (availableCount > 0) so existing reads keep working; services maintain it.
  quantity: integer('quantity').notNull().default(1),
  availableCount: integer('available_count').notNull().default(1),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  // --- 番薯 import fields (nullable; preserved so no catalog data is lost) ---
  copyCode: text('copy_code'), // 馆内编码
  category: text('category'), // 所属分类
  shelfLocation: text('shelf_location'), // 所属书架 (also backs B6 shelf location)
  translator: text('translator'), // 译者
  series: text('series'), // 系列
  pageCount: integer('page_count'), // 页数
  price: text('price'), // 价格 (string: mixed precision)
  priceUnit: text('price_unit'), // 价格单位 (USD/CNY/…)
  cnLibraryClass: text('cn_library_class'), // 中图法分类号
  enteredAt: text('entered_at'), // 录入时间 (上架/入库时间)
  isShelved: integer('is_shelved', { mode: 'boolean' }), // 已上架 (是/否)
  publishedDate: text('published_date'), // 出版时间 (full date string)
  wordCount: integer('word_count'), // 字数
  source: text('source'), // provenance, e.g. 'fanshu-import'
  // Full original export row(s) for this book — guarantees zero field loss even
  // for columns we don't model as typed fields.
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

/**
 * Library member record (番薯 "成员"). A borrowable identity that is NOT
 * necessarily a login account — the 番薯 export has names/phones but no emails,
 * so members can't become Better Auth users directly. A member MAY be linked to
 * a real `user` later (userId). Loans reference a member (see borrowTransactions
 * .memberId). `raw` preserves the complete original row (zero data loss).
 */
export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  name: text('name').notNull(),
  role: text('role', { enum: ['library_admin', 'library_reader'] })
    .notNull()
    .default('library_reader'),
  phone: text('phone'), // 手机
  email: text('email'), // 邮箱 (usually empty from 番薯)
  memberNo: text('member_no'), // 会员号
  employeeNo: text('employee_no'), // 工号
  studentNo: text('student_no'), // 学号
  className: text('class_name'), // 班级
  department: text('department'), // 部门
  note: text('note'), // 备注1 / 备注2 (merged)
  joinedAt: text('joined_at'), // 入馆日期
  membershipPlan: text('membership_plan'), // 会员计划
  memberStart: text('member_start'), // 会员起始日期
  memberExpiry: text('member_expiry'), // 会员到期日期
  borrowedCount: integer('borrowed_count'), // 在借数量
  returnedCount: integer('returned_count'), // 已还数量
  address: text('address'), // 地址
  roomNo: text('room_no'), // 房号
  age: integer('age'), // 年龄
  isPlaceholder: integer('is_placeholder', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id').references(() => user.id), // linked login account, if any
  source: text('source'), // 'fanshu-import'
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

/** Book reviews (番薯 评论清单). */
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  isbn: text('isbn'),
  bookTitle: text('book_title'), // 书名
  memberName: text('member_name'), // 用户馆内名称
  nickname: text('nickname'), // 用户昵称 (e.g. 微信用户)
  body: text('body').notNull(), // 评论
  reviewedAt: text('reviewed_at'), // 评论创建时间
  source: text('source'),
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

/** Purchase requests (番薯 荐购清单). */
export const purchaseRequests = sqliteTable('purchase_requests', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  isbn: text('isbn'),
  title: text('title').notNull(), // 书名
  author: text('author'), // 作者
  publisher: text('publisher'), // 出版社
  requesterCount: integer('requester_count').default(1), // 荐购人数
  requesters: text('requesters'), // 荐购人
  source: text('source'),
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const importRuns = sqliteTable('import_runs', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  source: text('source').notNull().default('fanshu'),
  sourceUrl: text('source_url'), // original download URL (e.g. cos1.fanshujieyue.com/…)
  r2Key: text('r2_key'), // archived copy in R2 (imports/fanshu/…)
  fileName: text('file_name'),
  ranByUserId: text('ran_by_user_id').references(() => user.id),
  status: text('status', { enum: ['success', 'failed'] }).notNull().default('success'),
  counts: text('counts', { mode: 'json' }).$type<Record<string, unknown>>(),
  error: text('error'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const borrowTransactions = sqliteTable('borrow_transactions', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  // App-created loans reference a login `user`; imported 番薯 loans reference a
  // `member` (no login account). Exactly one is set.
  userId: text('user_id').references(() => user.id),
  memberId: text('member_id').references(() => members.id),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  borrowedAt: text('borrowed_at').notNull(),
  dueDate: text('due_date').notNull(),
  returnedAt: text('returned_at'),
  source: text('source'), // 'fanshu-import' for imported history
  raw: text('raw', { mode: 'json' }).$type<Record<string, unknown>>(),
})

export const feedback = sqliteTable('feedback', {
  id: text('id').primaryKey(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  category: text('category', {
    enum: ['feature_request', 'bug', 'book_suggestion', 'other'],
  })
    .notNull()
    .default('other'),
  message: text('message').notNull(),
  status: text('status', { enum: ['new', 'reviewed', 'done'] }).notNull().default('new'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

/**
 * Append-only audit log of privileged actions (ADR 0004 Part A). Written
 * server-side at the guard/service layer — never from the client. `actorUserId`
 * is ALWAYS the real user; `onBehalfOfUserId` is set only during impersonation.
 * `libraryId` is the tenant scope (null for cross-tenant/system ops, e.g. tenant
 * create). Reads are tenant-scoped. Rows are never updated or deleted.
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id').notNull(),
  onBehalfOfUserId: text('on_behalf_of_user_id'),
  libraryId: text('library_id'),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// --- Relations ---
export const librariesRelations = relations(libraries, ({ many }) => ({
  books: many(books),
}))

export const booksRelations = relations(books, ({ one, many }) => ({
  library: one(libraries, { fields: [books.libraryId], references: [libraries.id] }),
  borrowTransactions: many(borrowTransactions),
}))

export const membersRelations = relations(members, ({ one, many }) => ({
  library: one(libraries, { fields: [members.libraryId], references: [libraries.id] }),
  user: one(user, { fields: [members.userId], references: [user.id] }),
  borrowTransactions: many(borrowTransactions),
}))

export const borrowTransactionsRelations = relations(borrowTransactions, ({ one }) => ({
  book: one(books, { fields: [borrowTransactions.bookId], references: [books.id] }),
  member: one(members, { fields: [borrowTransactions.memberId], references: [members.id] }),
}))

export type Library = typeof libraries.$inferSelect
export type Book = typeof books.$inferSelect
export type Member = typeof members.$inferSelect
export type Review = typeof reviews.$inferSelect
export type PurchaseRequest = typeof purchaseRequests.$inferSelect
export type BorrowTransaction = typeof borrowTransactions.$inferSelect
export type Feedback = typeof feedback.$inferSelect
export type ImportRun = typeof importRuns.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
