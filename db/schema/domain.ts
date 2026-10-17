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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
})

export const borrowTransactions = sqliteTable('borrow_transactions', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  borrowedAt: text('borrowed_at').notNull(),
  dueDate: text('due_date').notNull(),
  returnedAt: text('returned_at'),
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
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
})

// --- Relations ---
export const librariesRelations = relations(libraries, ({ many }) => ({
  books: many(books),
}))

export const booksRelations = relations(books, ({ one, many }) => ({
  library: one(libraries, { fields: [books.libraryId], references: [libraries.id] }),
  borrowTransactions: many(borrowTransactions),
}))

export const borrowTransactionsRelations = relations(borrowTransactions, ({ one }) => ({
  book: one(books, { fields: [borrowTransactions.bookId], references: [books.id] }),
}))

export type Library = typeof libraries.$inferSelect
export type Book = typeof books.$inferSelect
export type BorrowTransaction = typeof borrowTransactions.$inferSelect
export type Feedback = typeof feedback.$inferSelect
