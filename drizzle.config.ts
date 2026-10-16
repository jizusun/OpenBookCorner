import { defineConfig } from 'drizzle-kit'

// OpenBookCorner uses Cloudflare D1 (SQLite) in Phase 1.
// `drizzle-kit generate` produces SQL migrations in ./drizzle, applied to D1 via Wrangler:
//   npx wrangler d1 migrations apply openbookcorner --local   (local dev)
//   npx wrangler d1 migrations apply openbookcorner --remote  (deployed)
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
})
