import { schema, type Database } from '@obc/db'
import { drizzle } from 'drizzle-orm/d1'

/** Build a Drizzle client from the worker's D1 binding. */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema, casing: 'snake_case' }) as unknown as Database
}
