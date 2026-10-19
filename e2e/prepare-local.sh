#!/usr/bin/env bash
# Migrate + seed the LOCAL D1 (Miniflare) for E2E. Idempotent.
set -euo pipefail

# Apply migrations to the local D1 (wrangler reads apps/app/wrangler.jsonc).
# Do NOT swallow failures — a broken migration must fail E2E loudly, not silently
# leave the DB on an old schema (that previously hid a FK-constraint migration bug).
echo "y" | bunx wrangler d1 migrations apply openbookcorner --local

# Seed demo library + books (users are created via Better Auth in global-setup).
bunx wrangler d1 execute openbookcorner --local --command "
INSERT OR IGNORE INTO libraries (id,name,slug,brand_color,login_welcome,email_domains,settings,is_active,created_at,updated_at)
VALUES ('lib-demo-001','Acme Library','acme','#0a6ed1','Welcome to the Acme Library','[\"@demo.test\"]','{\"borrowingPeriodDays\":14,\"maxBooksPerReader\":5,\"allowExtensions\":false}',1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO libraries (id,name,slug,brand_color,login_welcome,email_domains,settings,is_active,created_at,updated_at)
VALUES ('lib-demo-002','Globex Library','globex','#b1420a','Welcome to the Globex Library','[\"@globex.test\"]','{\"borrowingPeriodDays\":21,\"maxBooksPerReader\":3,\"allowExtensions\":true}',1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO books (id,isbn,title,author,publisher,published_year,library_id,is_available,created_at,updated_at)
VALUES ('book-001','9780132350884','Clean Code','Robert C. Martin','Prentice Hall',2008,'lib-demo-001',1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');
INSERT OR IGNORE INTO books (id,isbn,title,author,publisher,published_year,library_id,is_available,created_at,updated_at)
VALUES ('book-101','9780262033848','Introduction to Algorithms','CLRS','MIT Press',2009,'lib-demo-002',1,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z');
" >/dev/null 2>&1 || true

echo "local D1 prepared"
