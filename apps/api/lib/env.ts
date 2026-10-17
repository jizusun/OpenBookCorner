import { z } from 'zod'

/** Environment contract for the OpenBookCorner API worker (Cloudflare D1). */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(['production', 'staging', 'preview', 'development']).default('development'),
  APP_NAME: z.string().default('OpenBookCorner'),
  APP_ORIGIN: z.string().url(),
  /**
   * Optional comma-separated allow-list of public origins that may front this
   * Worker (e.g. the global Cloudflare domain + a China relay domain served by
   * Traefik). When a trusted relay forwards `X-Forwarded-Origin` and it is in
   * this list, the Worker uses it as the effective APP_ORIGIN so Better Auth's
   * baseURL/cookies/CSRF match the browser's actual host. Falls back to
   * APP_ORIGIN when unset. APP_ORIGIN SHOULD also appear in this list.
   */
  APP_ORIGINS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
})

export type Env = z.infer<typeof envSchema> & {
  /** Cloudflare D1 binding (set in wrangler.jsonc). */
  DB: D1Database
  /** Cloudflare R2 bucket for stored book cover images. */
  COVERS: R2Bucket
}
