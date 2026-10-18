import type { Database } from '@obc/db'
import type { AuthSession, AuthUser } from './auth'
import type { Env } from './env'

/** Per-request context for every tRPC procedure. */
export type TRPCContext = {
  req: Request
  db: Database
  env: Env
  session: AuthSession | null
  user: AuthUser | null
  resHeaders?: Headers
}
