/**
 * @file Database schema exports + Drizzle D1 client type.
 *
 * OpenBookCorner uses Cloudflare D1 (SQLite). The API worker builds the client
 * from its D1 binding via `drizzle(env.DB, { schema })`.
 */
import type { DrizzleD1Database } from 'drizzle-orm/d1'

import * as schema from './schema'

export * from './schema'
export { schema }
export type DatabaseSchema = typeof schema

/** A Drizzle client bound to the OpenBookCorner schema, backed by Cloudflare D1. */
export type Database = DrizzleD1Database<DatabaseSchema>
