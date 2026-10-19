/**
 * Public, non-secret runtime config for the SPA. Used to gate NON-PRODUCTION
 * affordances (the click-to-fill demo accounts) — these must never show in
 * production. The same built SPA serves preview + production, so we resolve the
 * environment at runtime from the Worker rather than a build-time var.
 */

export interface AppConfig {
  environment: string
}

/** Fetch the runtime config. Returns null on failure (never throws). */
export async function fetchConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch('/api/public/config', { credentials: 'include' })
    if (!res.ok) return null
    return (await res.json()) as AppConfig
  } catch {
    return null
  }
}

/**
 * Whether non-production demo affordances should be shown. True only for a known
 * non-production environment. Unknown/null (fetch failed) → false, i.e. FAIL
 * CLOSED: if we can't confirm it's non-prod, don't reveal demo credentials.
 */
export function isDemoVisible(config: AppConfig | null): boolean {
  return !!config && config.environment !== 'production' && config.environment !== ''
}
