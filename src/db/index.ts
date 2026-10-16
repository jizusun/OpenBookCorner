import { drizzle } from 'drizzle-orm/d1'
// The Cloudflare vite-plugin exposes Worker bindings via the `cloudflare:workers` module.
// This is the single place that reads the D1 binding (KISS — no extra abstraction layer).
import { env } from 'cloudflare:workers'
import * as schema from './schema'

/** Returns a Drizzle client bound to the Cloudflare D1 database for the current request. */
export function getDb() {
  return drizzle(env.DB, { schema })
}

export type Db = ReturnType<typeof getDb>
