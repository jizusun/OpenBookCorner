import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'
import * as schema from '@/db/schema'
import type { Db } from '@/db'

// Builds an in-memory SQLite DB (pure WASM via sql.js — no native binary) with the
// OpenBookCorner schema for service tests. drizzle-orm/sql-js is API-compatible with the
// D1 driver for the queries we use, except `.batch()` which D1 provides — shimmed below.
export async function createTestDb() {
  const SQL = await initSqlJs()
  const sqlite = new SQL.Database()
  sqlite.run(`
    CREATE TABLE libraries (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email_domains TEXT NOT NULL,
      settings TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, library_id TEXT NOT NULL, role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE books (
      id TEXT PRIMARY KEY, isbn TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
      publisher TEXT, published_year INTEGER, cover_image_url TEXT, description TEXT, subjects TEXT,
      library_id TEXT NOT NULL, is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE borrow_transactions (
      id TEXT PRIMARY KEY, book_id TEXT NOT NULL, user_id TEXT NOT NULL, library_id TEXT NOT NULL,
      borrowed_at TEXT NOT NULL, due_date TEXT NOT NULL, returned_at TEXT
    );
    CREATE TABLE feedback (
      id TEXT PRIMARY KEY, library_id TEXT NOT NULL, user_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other', message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  const db = drizzle(sqlite, { schema }) as unknown as Db

  // D1 exposes `.batch([...])`; the sql-js driver does not. Shim it (sequential is fine for tests).
  const anyDb = db as unknown as { batch?: (stmts: Array<Promise<unknown>>) => Promise<unknown[]> }
  if (!anyDb.batch) {
    anyDb.batch = async (stmts) => Promise.all(stmts)
  }
  return db
}

export async function seedLibrary(db: Db, id: string, domains: string[] = ['@test.com']) {
  await db.insert(schema.libraries).values({
    id,
    name: `Library ${id}`,
    emailDomains: domains,
    settings: { borrowingPeriodDays: 14, maxBooksPerReader: 5, allowExtensions: false },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export async function seedUser(db: Db, id: string, libraryId: string) {
  await db.insert(schema.users).values({
    id,
    email: `${id}@test.com`,
    name: id,
    passwordHash: 'x',
    libraryId,
    role: 'library_reader',
    isActive: true,
    createdAt: new Date().toISOString(),
  })
}

export async function seedBook(db: Db, id: string, libraryId: string) {
  await db.insert(schema.books).values({
    id,
    isbn: '9780000000001',
    title: `Book ${id}`,
    author: 'Author',
    libraryId,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}
