import { z } from 'zod'

/** Environment contract for the OpenBookCorner API worker (Cloudflare D1). */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(['production', 'staging', 'development']).default('development'),
  APP_NAME: z.string().default('OpenBookCorner'),
  APP_ORIGIN: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
})

export type Env = z.infer<typeof envSchema> & {
  /** Cloudflare D1 binding (set in wrangler.jsonc). */
  DB: D1Database
}
