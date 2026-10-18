/**
 * Pure, dependency-free helpers for multi-tenant subdomains + proxy origin
 * trust (ADR 0003). Kept pure so they are cheaply unit-tested and reused by the
 * Worker, the branding endpoint, and the guards.
 */

/** Subdomains that are NEVER tenants (infra / reserved). */
export const RESERVED_SUBDOMAINS = ['www', 'app', 'admin', 'api', 'preview'] as const

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/ // 2–40, no leading/trailing hyphen

/** A valid tenant slug: 2–40 chars, lowercase alnum + internal hyphens, not reserved. */
export function isValidSlug(slug: string): boolean {
  if (!SLUG_RE.test(slug)) return false
  if ((RESERVED_SUBDOMAINS as readonly string[]).includes(slug)) return false
  if (/^pr-\d+$/.test(slug)) return false // per-PR preview hosts
  return true
}

/**
 * Resolve the tenant slug from a request Host, or null when the host is the
 * apex, a reserved subdomain, a per-PR preview, a foreign domain, or otherwise
 * not a single-label valid tenant under `baseDomain`.
 */
export function resolveTenantHost(host: string, baseDomain: string): string | null {
  if (!host) return null
  const hostname = host.split(':')[0]!.toLowerCase() // strip port
  if (hostname === baseDomain) return null // apex
  const suffix = `.${baseDomain}`
  if (!hostname.endsWith(suffix)) return null // foreign domain
  const label = hostname.slice(0, -suffix.length)
  if (!label || label.includes('.')) return null // must be a single label
  if (/^pr-\d+$/.test(label)) return null // per-PR preview
  if ((RESERVED_SUBDOMAINS as readonly string[]).includes(label)) return null
  if (!isValidSlug(label)) return null
  return label
}

/** A trusted-origin pattern: a host dot-suffix + an exact required port (null = https default 443). */
export interface OriginPattern {
  suffix: string
  port: number | null
}

/**
 * Allow-list match for a forwarded/relay origin. ONLY accepts `https`, a host
 * that is the suffix itself or ends with `.suffix` (dot-anchored — no substring
 * confusion), and an exact port match (null ⇒ the default https port, i.e. no
 * explicit port). Everything else (wrong scheme/port, prefix/suffix confusion,
 * userinfo, garbage) is rejected. Never use substring checks for this.
 */
export function isAllowedOrigin(value: string, patterns: OriginPattern[]): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false // userinfo trick
  if (url.pathname !== '/' && url.pathname !== '') return false
  const host = url.hostname.toLowerCase()
  // url.port is '' when the default port is used.
  const actualPort = url.port === '' ? null : Number(url.port)
  for (const { suffix, port } of patterns) {
    const hostOk = host === suffix || host.endsWith(`.${suffix}`)
    const portOk = port === null ? actualPort === null : actualPort === port
    if (hostOk && portOk) return true
  }
  return false
}

/**
 * Parse an `APP_ORIGINS` env value (comma-separated list of trusted origins,
 * e.g. `https://openbookcorner.jizu.dev,https://obc.cloud.jizu.dev:666`) into
 * suffix+port patterns for `isAllowedOrigin`. Each origin's hostname becomes a
 * trusted dot-suffix (so it matches itself AND its subdomains — e.g. tenant
 * subdomains under the apex, or `*.cloud.jizu.dev` relay hosts) and its explicit
 * port (null ⇒ https default). Garbage/non-https entries are skipped.
 */
export function parseOriginPatterns(value: string | undefined): OriginPattern[] {
  if (!value) return []
  const out: OriginPattern[] = []
  for (const raw of value.split(',')) {
    const entry = raw.trim()
    if (!entry) continue
    let url: URL
    try {
      url = new URL(entry)
    } catch {
      continue
    }
    if (url.protocol !== 'https:') continue
    out.push({ suffix: url.hostname.toLowerCase(), port: url.port === '' ? null : Number(url.port) })
  }
  return out
}

/**
 * Resolve the effective browser-facing origin for a request behind an optional
 * trusted proxy/relay (ADR 0003 §7). The relay forwards its browser-facing
 * origin via `X-Forwarded-Origin`; the Worker honors it ONLY when it matches the
 * `APP_ORIGINS` allow-list (`isAllowedOrigin`). Any unlisted/spoofed value is
 * ignored and the configured `appOrigin` is used — a spoof degrades to "normal
 * origin", never a CSRF/origin bypass.
 */
export function resolveEffectiveOrigin(
  appOrigin: string,
  forwardedOrigin: string | undefined,
  patterns: OriginPattern[],
): string {
  if (forwardedOrigin && isAllowedOrigin(forwardedOrigin, patterns)) {
    return new URL(forwardedOrigin).origin
  }
  return appOrigin
}
