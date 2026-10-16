import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit config for Cloudflare D1 (SQLite). We only use drizzle-kit to
 * GENERATE SQL migrations into ./migrations; they are applied to D1 with
 * `wrangler d1 migrations apply` (local or remote), not by drizzle-kit.
 */
export default defineConfig({
  out: './migrations',
  schema: './schema/index.ts',
  dialect: 'sqlite',
  casing: 'snake_case',
})
