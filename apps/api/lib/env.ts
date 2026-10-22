import { z } from 'zod'

/** Environment contract for the OpenBookCorner API worker (Cloudflare D1). */
export const envSchema = z.object({
  ENVIRONMENT: z.enum(['production', 'staging', 'preview', 'development']).default('development'),
  APP_NAME: z.string().default('OpenBookCorner'),
  APP_ORIGIN: z.string().url(),
  /**
   * Optional comma-separated allow-list of every public origin that may front
   * the Worker (ADR 0003 §7), e.g. the China relay on :666. Parsed into
   * suffix+port patterns by `parseOriginPatterns`. Empty ⇒ only APP_ORIGIN.
   */
  APP_ORIGINS: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
  /** Resend API key for transactional email (ADR 0009 Phase 2). Optional —
   *  when absent the EmailService is a no-op so the worker still boots. */
  RESEND_API_KEY: z.string().optional(),
  /** Sender address for outgoing email, e.g. noreply@yourdomain.com. */
  RESEND_FROM: z.string().optional().default('onboarding@resend.dev'),
})

export type Env = z.infer<typeof envSchema> & {
  /** Cloudflare D1 binding (set in wrangler.jsonc). */
  DB: D1Database
  /** Cloudflare R2 bucket for stored book cover images. */
  COVERS: R2Bucket
}
