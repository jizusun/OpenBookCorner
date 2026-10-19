/**
 * Pure, dependency-free helpers for PATH-based multi-tenancy (/t/:slug, ADR
 * 0003) + proxy origin trust. Kept pure so they are cheaply unit-tested and
 * reused by the branding endpoint, the frontend router, and the relay logic.
 */

/**
 * Slugs that would collide with top-level app routes and so are never valid
 * tenant slugs (defense-in-depth; the `/t/` prefix already namespaces tenants).
 */
export const RESERVED_SLUGS = ['www', 'app', 'admin', 'api', 'login', 'preview', 'health'] as const

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$/ // 2–40, no leading/trailing hyphen

/** A valid tenant slug: 2–40 chars, lowercase alnum + internal hyphens, not reserved. */
export function isValidSlug(slug: string): boolean {
  if (!SLUG_RE.test(slug)) return false
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) return false
  if (/^pr-\d+$/.test(slug)) return false // per-PR preview artifacts
  return true
}

/**
 * Derive a URL slug from a free-text library name: lowercase, non-alnum → single
 * hyphens, trimmed of leading/trailing hyphens, truncated to 40 chars. Returns
 * null when nothing usable remains or the result is too short (<2). The caller
 * ensures uniqueness + validity (isValidSlug) separately.
 */
export function slugify(name: string): string | null {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '') // slice may leave a trailing hyphen
  return s.length >= 2 ? s : null
}

/**
 * Resolve the tenant slug from a request path of the form `/t/:slug/...`, or
 * null when the path has no `/t/` prefix or the slug segment is invalid/reserved.
 * Tenant membership itself is still enforced by the session `libraryId`; this is
 * for client routing + branding, not the isolation boundary.
 */
export function resolveTenantPath(pathname: string): string | null {
  if (!pathname) return null
  const segments = pathname.split('/').filter(Boolean) // drop empty (leading/trailing slashes)
  if (segments[0] !== 't' || segments.length < 2) return null
  const slug = segments[1]!.toLowerCase()
  return isValidSlug(slug) ? slug : null
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
