-- OpenBookCorner demo seed: library + books.
-- Users are created via Better Auth sign-up (see db/scripts/seed-users.sh), then
-- their library_id/role are set with the UPDATE statements at the bottom.

INSERT OR IGNORE INTO libraries (id, name, email_domains, settings, is_active, created_at, updated_at)
VALUES (
  'lib-demo-001',
  'Demo Library',
  '["@demo.test"]',
  '{"borrowingPeriodDays":14,"maxBooksPerReader":5,"allowExtensions":false}',
  1,
  '2025-01-01T00:00:00.000Z',
  '2025-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO books (id, isbn, title, author, publisher, published_year, library_id, is_available, created_at, updated_at)
VALUES
  ('book-001', '9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-002', '9780201633610', 'Design Patterns', 'Gang of Four', 'Addison-Wesley', 1994, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z'),
  ('book-003', '9780137081073', 'The Clean Coder', 'Robert C. Martin', 'Prentice Hall', 2011, 'lib-demo-001', 1, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');

-- Attach demo users to the library + roles (run AFTER they sign up).
UPDATE user SET library_id = 'lib-demo-001', role = 'library_admin'  WHERE email = 'admin@demo.test';
UPDATE user SET library_id = 'lib-demo-001', role = 'library_reader' WHERE email = 'reader@demo.test';
UPDATE user SET library_id = 'lib-demo-001', role = 'super_admin'    WHERE email = 'super@demo.test';
