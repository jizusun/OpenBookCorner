import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// --- Multi-tenant foundation ---
// Every tenant-scoped table carries `libraryId`. ALL queries MUST filter by it.

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

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Argon2/scrypt hash for Phase 1 email/password auth
  passwordHash: text('password_hash').notNull(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  role: text('role', {
    enum: ['super_admin', 'library_admin', 'library_reader'],
  }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastLoginAt: text('last_login_at'),
})

// Lucia session table (stores expiry as unix seconds)
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
})

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  isbn: text('isbn').notNull(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
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
    .references(() => users.id),
  libraryId: text('library_id')
    .notNull()
    .references(() => libraries.id),
  borrowedAt: text('borrowed_at').notNull(),
  dueDate: text('due_date').notNull(),
  returnedAt: text('returned_at'),
})

// --- Relations ---
export const librariesRelations = relations(libraries, ({ many }) => ({
  users: many(users),
  books: many(books),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  library: one(libraries, { fields: [users.libraryId], references: [libraries.id] }),
  borrowTransactions: many(borrowTransactions),
}))

export const booksRelations = relations(books, ({ one, many }) => ({
  library: one(libraries, { fields: [books.libraryId], references: [libraries.id] }),
  borrowTransactions: many(borrowTransactions),
}))

export const borrowTransactionsRelations = relations(borrowTransactions, ({ one }) => ({
  book: one(books, { fields: [borrowTransactions.bookId], references: [books.id] }),
  user: one(users, { fields: [borrowTransactions.userId], references: [users.id] }),
}))

// Inferred row types (no `any`)
export type Library = typeof libraries.$inferSelect
export type User = typeof users.$inferSelect
export type Book = typeof books.$inferSelect
export type BorrowTransaction = typeof borrowTransactions.$inferSelect
