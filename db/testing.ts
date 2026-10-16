/**
 * In-memory SQLite test database (pure WASM via sql.js — no native binary).
 * drizzle-orm/sql-js is API-compatible with the D1 driver for the queries our
 * services use, except `.batch()` which D1 provides — shimmed below.
 */
import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sql-js'

import * as schema from './schema'
import type { Database } from './index'

export async function createTestDb(): Promise<Database> {
  const SQL = await initSqlJs()
  const sqlite = new SQL.Database()
  sqlite.run(`
    CREATE TABLE libraries (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email_domains TEXT NOT NULL,
      settings TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
      library_id TEXT, role TEXT NOT NULL DEFAULT 'library_reader',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
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
  const db = drizzle(sqlite, { schema }) as unknown as Database

  const anyDb = db as unknown as {
    batch?: (stmts: Array<Promise<unknown>>) => Promise<unknown[]>
  }
  if (!anyDb.batch) {
    anyDb.batch = async (stmts) => Promise.all(stmts)
  }
  return db
}

export async function seedLibrary(db: Database, id: string, domains: string[] = ['@test.com']) {
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

export async function seedUser(db: Database, id: string, libraryId: string, role = 'library_reader') {
  await db.insert(schema.user).values({
    id,
    email: `${id}@test.com`,
    name: id,
    emailVerified: true,
    libraryId,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

export async function seedBook(db: Database, id: string, libraryId: string, isbn = '9780000000001') {
  await db.insert(schema.books).values({
    id,
    isbn,
    title: `Book ${id}`,
    author: 'Author',
    libraryId,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}
