import { execSync } from 'node:child_process'

/**
 * Runs once before the suite (after webServers are up). Creates the demo reader
 * via Better Auth sign-up, then attaches them to the demo library with a role.
 */
async function createUser(email: string, name: string) {
  const res = await fetch('http://localhost:8787/api/auth/sign-up/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Better Auth rejects requests without an Origin that matches a trusted
      // origin (MISSING_OR_NULL_ORIGIN). The single worker's APP_ORIGIN is :8787.
      origin: 'http://localhost:8787',
    },
    body: JSON.stringify({ email, password: 'password123', name }),
  })
  // 200 = created; 422/400 = already exists (idempotent re-runs) — both fine.
  if (!res.ok && res.status !== 422 && res.status !== 400) {
    throw new Error(`sign-up failed for ${email}: ${res.status} ${await res.text()}`)
  }
}

export default async function globalSetup() {
  // Wait for the API to be reachable.
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://localhost:8787/health')
      if (r.ok) break
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  await createUser('reader@demo.test', 'Demo Reader')
  await createUser('admin@demo.test', 'Demo Admin')
  await createUser('super@demo.test', 'Demo Super Admin')

  // Attach to the demo library + roles (local D1). Also create membership rows
  // so the new active-membership tenant guard works (ADR 0009).
  const sql =
    "UPDATE user SET library_id='lib-demo-001', role='library_admin', active_library_id='lib-demo-001' WHERE email='admin@demo.test';" +
    "UPDATE user SET library_id='lib-demo-001', role='library_reader', active_library_id='lib-demo-001' WHERE email='reader@demo.test';" +
    "UPDATE user SET library_id='lib-demo-001', role='super_admin',    active_library_id='lib-demo-001' WHERE email='super@demo.test';" +
    // Membership rows so the tenant guard resolves role from membership.
    "INSERT OR IGNORE INTO membership (id, user_id, library_id, role, status, created_at, updated_at)" +
    " SELECT lower(hex(randomblob(16))), u.id, 'lib-demo-001'," +
    "   CASE u.email WHEN 'admin@demo.test' THEN 'library_admin' ELSE 'library_reader' END," +
    "   'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM user u" +
    "   WHERE u.email IN ('admin@demo.test','reader@demo.test')" +
    "   AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id=u.id AND m.library_id='lib-demo-001');" +
    // Link a member to the reader's login account for impersonation tests.
    "INSERT OR IGNORE INTO members (id, library_id, name, role, email, user_id, is_placeholder, created_at)" +
    " SELECT 'member-demo-reader','lib-demo-001','Demo Reader','library_reader','reader@demo.test', u.id, 0, '2025-01-01T00:00:00.000Z'" +
    " FROM user u WHERE u.email='reader@demo.test';" +
    "UPDATE members SET user_id=(SELECT id FROM user WHERE email='reader@demo.test') WHERE id='member-demo-reader';"
  execSync(
    `bunx wrangler d1 execute openbookcorner --local --persist-to .wrangler/state-e2e --command "${sql}"`,
    { cwd: new URL('../apps/app', import.meta.url).pathname, stdio: 'ignore' },
  )
}
