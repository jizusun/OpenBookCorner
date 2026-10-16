import { hashPassword } from '../src/server/auth/password'

// Generates seed SQL for an initial tenant + admin + reader (manual tenant setup, MVP Req 1.4/1.5).
// Usage:
//   npx tsx scripts/seed.ts > drizzle/seed.sql
//   npx wrangler d1 execute openbookcorner --local  --file drizzle/seed.sql   # local dev
//   npx wrangler d1 execute openbookcorner --remote --file drizzle/seed.sql   # deployed
//
// Default demo credentials (CHANGE for anything real):
//   admin@demo.test  / password123   (library_admin)
//   reader@demo.test / password123   (library_reader)

const LIBRARY_ID = 'lib-demo-001'
const now = new Date().toISOString()

function esc(v: string) {
  return v.replace(/'/g, "''")
}

async function main() {
  const adminHash = await hashPassword('password123')
  const readerHash = await hashPassword('password123')

  const settings = JSON.stringify({
    borrowingPeriodDays: 14,
    maxBooksPerReader: 5,
    allowExtensions: false,
  })
  const domains = JSON.stringify(['@demo.test'])

  const lines = [
    `INSERT OR IGNORE INTO libraries (id, name, email_domains, settings, is_active, created_at, updated_at) VALUES ('${LIBRARY_ID}', 'Demo Library', '${esc(domains)}', '${esc(settings)}', 1, '${now}', '${now}');`,
    `INSERT OR IGNORE INTO users (id, email, name, password_hash, library_id, role, is_active, created_at) VALUES ('user-admin-001', 'admin@demo.test', 'Demo Admin', '${esc(adminHash)}', '${LIBRARY_ID}', 'library_admin', 1, '${now}');`,
    `INSERT OR IGNORE INTO users (id, email, name, password_hash, library_id, role, is_active, created_at) VALUES ('user-reader-001', 'reader@demo.test', 'Demo Reader', '${esc(readerHash)}', '${LIBRARY_ID}', 'library_reader', 1, '${now}');`,
    `INSERT OR IGNORE INTO books (id, isbn, title, author, library_id, is_available, created_at, updated_at) VALUES ('book-001', '9780132350884', 'Clean Code', 'Robert C. Martin', '${LIBRARY_ID}', 1, '${now}', '${now}');`,
    `INSERT OR IGNORE INTO books (id, isbn, title, author, library_id, is_available, created_at, updated_at) VALUES ('book-002', '9780201633610', 'Design Patterns', 'Gang of Four', '${LIBRARY_ID}', 1, '${now}', '${now}');`,
  ]
  process.stdout.write(lines.join('\n') + '\n')
}

void main()
