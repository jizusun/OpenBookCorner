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
  /**
   * The base domain under which tenant subdomains live (ADR 0003), e.g.
   * `openbookcorner.jizu.dev` ⇒ `acme.openbookcorner.jizu.dev`. Decoupled from
   * APP_ORIGIN so previews can run on a SEPARATE domain without the preview host
   * being parsed as a tenant (and vice-versa). Defaults to the APP_ORIGIN host
   * when unset.
   */
  TENANT_BASE_DOMAIN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(16),
})

export type Env = z.infer<typeof envSchema> & {
  /** Cloudflare D1 binding (set in wrangler.jsonc). */
  DB: D1Database
  /** Cloudflare R2 bucket for stored book cover images. */
  COVERS: R2Bucket
}
