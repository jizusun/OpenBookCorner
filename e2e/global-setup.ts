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
      // origin (MISSING_OR_NULL_ORIGIN). In dev, APP_ORIGIN is the SPA origin.
      origin: 'http://localhost:5173',
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

  // Attach to the demo library + roles (local D1). The super admin also gets the
  // demo library so Admin/Reader views work when they switch; their System view
  // (tenant management) is role-based and spans all libraries.
  const sql =
    "UPDATE user SET library_id='lib-demo-001', role='library_admin' WHERE email='admin@demo.test';" +
    "UPDATE user SET library_id='lib-demo-001', role='library_reader' WHERE email='reader@demo.test';" +
    "UPDATE user SET library_id='lib-demo-001', role='super_admin' WHERE email='super@demo.test';"
  execSync(
    `bunx wrangler d1 execute openbookcorner --local --command "${sql}"`,
    { cwd: new URL('../apps/api', import.meta.url).pathname, stdio: 'ignore' },
  )
}
