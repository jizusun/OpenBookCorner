-- OpenBookCorner demo seed: TWO tenants (libraries) + books, to exercise
-- path-based multi-tenancy (/t/:slug). Users are created via Better Auth sign-up
-- (see db/scripts/seed-users.sh), then their library_id/role are set below.

-- Tenant 1: Acme Library  → /t/acme
INSERT OR IGNORE INTO libraries (id, name, slug, brand_color, login_welcome, email_domains, settings, is_active, created_at, updated_at)
VALUES (
  'lib-demo-001', 'Acme Library', 'acme', '#0a6ed1', 'Welcome to the Acme Library',
  '["@demo.test"]', '{"borrowingPeriodDays":14,"maxBooksPerReader":5,"allowExtensions":false}',
  1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
);

-- Tenant 2: Globex Library → /t/globex
INSERT OR IGNORE INTO libraries (id, name, slug, brand_color, login_welcome, email_domains, settings, is_active, created_at, updated_at)
VALUES (
  'lib-demo-002', 'Globex Library', 'globex', '#b1420a', 'Welcome to the Globex Library',
  '["@globex.test"]', '{"borrowingPeriodDays":21,"maxBooksPerReader":3,"allowExtensions":true}',
  1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'
);

-- Books per tenant (isolation is proven by each tenant seeing only its own).
INSERT OR IGNORE INTO books (id, isbn, title, author, publisher, published_year, library_id, is_available, created_at, updated_at)
VALUES
  ('book-001', '9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-002', '9780201633610', 'Design Patterns', 'Gang of Four', 'Addison-Wesley', 1994, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-003', '9780137081073', 'The Clean Coder', 'Robert C. Martin', 'Prentice Hall', 2011, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-101', '9780262033848', 'Introduction to Algorithms', 'CLRS', 'MIT Press', 2009, 'lib-demo-002', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-102', '9781491950357', 'Programming Rust', 'Blandy & Orendorff', 'O''Reilly', 2017, 'lib-demo-002', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');

-- Attach demo users to their library + role (run AFTER they sign up).
-- super_admin is intentionally NOT granted here (privilege-escalation risk on a
-- deployed DB); it is granted only by db/scripts/seed-users.sh for CI/preview.
-- Acme:
UPDATE user SET library_id = 'lib-demo-001', role = 'library_admin'  WHERE email = 'admin@demo.test';
UPDATE user SET library_id = 'lib-demo-001', role = 'library_reader' WHERE email = 'reader@demo.test';
-- Globex:
UPDATE user SET library_id = 'lib-demo-002', role = 'library_admin'  WHERE email = 'admin@globex.test';
UPDATE user SET library_id = 'lib-demo-002', role = 'library_reader' WHERE email = 'reader@globex.test';
