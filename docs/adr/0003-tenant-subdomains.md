# ADR 0003: Per-tenant subdomains with customized login

- Status: Proposed
- Date: 2026-10-19
- Builds on: ADR 0001 (product scope, multi-tenant rules, Cloudflare hosting) and
  ADR 0002 (Bun monorepo, Better Auth, Drizzle/D1). NOTE: the API layer is now
  **Hono `hc`** (typed RPC) after the tRPC→hc rewrite — this doc assumes `hc`.

## Context

Today OpenBookCorner serves every tenant (library) from a **single origin**
(`openbookcorner.jizu.dev`) with **one shared login page** at `/login`. A user's
tenant is derived from their `user.libraryId` **after** they authenticate; the
URL carries no tenant identity. Tenant isolation is enforced in the API by
scoping every query to the session's `libraryId` (see `apps/api/lib/mw.ts`:
`sessionAuth → tenant → admin → superAdmin`).

We want each tenant to have:

1. **Its own URL**, so a library has a branded, memorable address.
2. **A customized login page** (its name, logo, brand color, welcome text), so a
   member recognizes they are logging into *their* library.

This is a recognized multi-tenant pattern ("domain-driven routing", AWS) and the
explicit goal of multi-tenant identity ("each org gets its own login
experience"). It also raises a security-sensitive question — how the **super
admin** (who belongs to no single tenant) logs in — which this ADR resolves.

## Decision

### 1. URL shape: tenant **subdomains**

Each tenant gets `‹slug›.openbookcorner.jizu.dev` (e.g.
`acme.openbookcorner.jizu.dev`).

Chosen over path-based (`/t/‹slug›`) and custom domains because the Cloudflare
infrastructure is **already in place** (verified against zone `jizu.dev`,
2026-10-19):

- A **proxied wildcard DNS record** `*.openbookcorner.jizu.dev` (AAAA `100::`,
  proxied) already exists — the same record that makes preview hosts resolve.
- The **wildcard TLS cert** `*.openbookcorner.jizu.dev` already exists (advanced
  certificate used by previews). No ACM/Total TLS provisioning needed.
- Preview hosts (`preview.`, `pr-N.`) already prove arbitrary subdomains reach
  the `openbookcorner` Worker.

The only new Cloudflare change is a **Worker route** `*.openbookcorner.jizu.dev/*`
→ the `openbookcorner` Worker.

> **China relay interaction.** The Traefik relay (`obc.cloud.jizu.dev:666`)
> fronts the Worker to cut China latency. Per-tenant subdomains change what the
> relay must forward and trust — this is now a **first-class part of the design**
> (see §7: "China relay + proxy/port support"), not an afterthought.

### 2. Tenant resolution: from the `Host` header, in the Worker

The Worker resolves the tenant from the request Host (it already derives
`APP_ORIGIN` from the request for previews, so this extends existing logic):

- `‹slug›.openbookcorner.jizu.dev` → look up the library by `slug`.
- **Reserved subdomains are NOT tenants** and fall through to the apex behavior:
  `www`, `app`, `admin`, `api`, `preview`, and `pr-*` (per-PR previews). The
  resolver MUST exclude these so a preview deploy never resolves a tenant named
  "preview".
- Unknown/inactive slug → a friendly "library not found" page (not a crash).

### 3. The URL is **branding + expected-tenant**, never the source of truth

`user.libraryId` from the verified Better Auth session remains the **only**
source of truth for isolation (security sources: "bind every authz decision to a
tenant context first"). The subdomain:

- selects which **login branding** to show (pre-auth), and
- is the **expected tenant**; after auth we **enforce** that the user belongs to
  it.

Post-auth rule on a tenant subdomain:

```
if (role === 'super_admin')              → redirect to the apex (see §5)
else if (user.libraryId !== tenant.id)   → reject / redirect to the user's own tenant
else                                      → proceed into this tenant
```

This means the API's existing `libraryId`-scoped enforcement is unchanged; the
subdomain adds a guard, never a bypass.

### 4. Customized login (light-to-medium)

Add branding columns to `libraries` and a **public, unauthenticated** endpoint to
fetch *only safe* branding fields by host/slug, so the login page can render
before the user authenticates:

New `libraries` columns (Drizzle / D1 migration):

| column | type | purpose |
| --- | --- | --- |
| `slug` | text, **unique** | subdomain label (`acme`); validated `^[a-z0-9-]{2,40}$`; not a reserved word |
| `logoUrl` | text, null | tenant logo (R2/CDN URL) |
| `brandColor` | text, null | hex accent for the login/theme |
| `loginWelcome` | text, null | short welcome line |

Public endpoint: `GET /api/tenant/branding?host=‹host›` (or `/by-slug/:slug`)

- Returns ONLY `{ name, logoUrl, brandColor, loginWelcome }` — never
  `emailDomains`, settings, counts, or anything sensitive.
- Validates the slug, excludes reserved words, and is **rate-limited** (it is the
  one unauthenticated surface).
- Mounted outside the `sessionAuth` guard (sibling of Better Auth routes).

The login page (`/login`, rendered on the tenant subdomain) reads branding by
host and shows the tenant's name/logo/color/welcome. On the apex it shows the
standard unbranded login. Demo accounts are hidden on real tenant hosts.

### 5. Super admin login: the **apex** host (not a tenant subdomain)

Super admins belong to no single tenant, so they authenticate on the **apex**
`openbookcorner.jizu.dev` (standard login) and land in the system view
(`/admin/tenants`), exactly as today. Tenant subdomains are **members-only**; a
super admin who lands on one is redirected to the apex (§3) — never silently
logged into a tenant.

> **Cross-tenant support is NOT a login bypass.** Letting a super admin "just log
> into any tenant subdomain" is the wrong shape (security sources: weak tenant
> context → cross-tenant incident). If we later need an admin to see a tenant's
> view, it will be a dedicated **impersonation** feature following best practice
> (Pigment): a **separate, short-lived (~30 min) session**, **read-only by
> default** (enforced in middleware, not UI), a **full audit trail** (who/whom/
> when/which tenant), and a persistent **on-screen banner**. Explicitly OUT of
> scope for v1; tracked as a follow-up.

### 6. Cookies / session scope

Better Auth cookies are per-host. Per-subdomain cookies are the **safer default**
(a session on `acme.` is not valid on `beta.`), reinforcing isolation. We do NOT
set a parent-domain cookie. `APP_ORIGIN` is derived from the request Host (as in
preview) so Better Auth's `baseURL`/cookies match the tenant host. This composes
with the existing `APP_ORIGINS` allow-list used for the China relay (see §7).

### 7. China relay + proxy/port support (first-class)

A **Traefik relay on a China VPC** (`qcloud`, host `obc.cloud.jizu.dev`, HTTPS on
**port `:666`**) reverse-proxies to the Cloudflare Worker to cut China latency.
Because the relay presents a **different public origin** (a different host *and a
non-standard port*) than the one Cloudflare routes by, the Worker must be told
the browser-facing origin explicitly, or Better Auth's `baseURL`/cookies/CSRF
will not match the host the browser is on and **login breaks**.

This is solved by a small, security-reviewed mechanism (supersedes the stale
PR #9 implementation, which predates the Hono-`hc` rewrite and no longer merges):

**a) Origin allow-list, not origin trust.** The Worker reads an `APP_ORIGINS`
env var (comma-separated allow-list of every public origin that may legitimately
front the Worker), e.g.:

```
APP_ORIGIN  = https://openbookcorner.jizu.dev
APP_ORIGINS = https://openbookcorner.jizu.dev,https://obc.cloud.jizu.dev:666
```

**b) Relay forwards its browser-facing origin.** Traefik injects
`X-Forwarded-Origin: https://obc.cloud.jizu.dev:666` and dials Cloudflare with
`passHostHeader: false` (so Cloudflare still routes by the Worker's own host).

**c) Worker honors it ONLY if allow-listed.** The Worker uses
`X-Forwarded-Origin` as the effective `APP_ORIGIN` **only when it appears in
`APP_ORIGINS`**; otherwise it falls back to the configured origin. An
arbitrary/unlisted forwarded origin is ignored — no origin/CSRF spoofing. Better
Auth's `trustedOrigins` is the full `APP_ORIGINS` list. This holds in both
production and preview (so the relay can point at either).

**Port `:666` is part of the contract.** The browser `Origin` header includes
the non-standard port, so every value above MUST carry `:666` byte-for-byte
(`APP_ORIGINS` entry, the `X-Forwarded-Origin` Traefik sends, and Better Auth's
trusted origin). A mismatch on the port alone fails CSRF.

**How this extends to per-tenant subdomains.** With subdomains, the relay must
front `‹slug›.openbookcorner.jizu.dev` too. Two options:

| Option | Relay change | APP_ORIGINS | Notes |
| --- | --- | --- | --- |
| **Per-tenant relay host** (`‹slug›.cloud.jizu.dev:666`) | one Traefik router per tenant | one entry per tenant origin | precise but O(tenants) config |
| **Wildcard relay** (`*.obc.cloud.jizu.dev:666` or path) | one wildcard Traefik router + `*.cloud.jizu.dev` cert (already held) | a wildcard/allow-pattern | scales to all tenants; preferred |

Because a static comma list can't scale to many tenants, the allow-list check
SHOULD be generalized to **match a trusted suffix pattern** (e.g.
`*.openbookcorner.jizu.dev` and the relay's `*.cloud.jizu.dev:666`) rather than
exact strings — still an allow-list (closed set of trusted suffixes/ports),
never raw header trust. Reserved-subdomain exclusion (§2) still applies.

**Matching MUST be anchored URL parsing, never substring.** `X-Forwarded-Origin`
is attacker-controllable (the Worker is directly reachable at
`openbookcorner.jizu.dev`, so a client can bypass the relay and forge the
header). Parse the value with `new URL()` and verify **(a)** scheme is `https`,
**(b)** host is the apex OR ends with a trusted dot-suffix (`.openbookcorner.jizu.dev`),
and **(c)** port matches exactly (incl. the relay's `:666`). Do NOT use
`includes()`/`startsWith()`. Named bypasses the check MUST reject:

| Forged value | Why it must fail |
| --- | --- |
| `https://evil-openbookcorner.jizu.dev` | suffix confusion (no dot boundary) |
| `https://openbookcorner.jizu.dev.evil.com` | trusted string as a prefix of a longer host |
| `https://obc.cloud.jizu.dev:6666` / `:80` | wrong port (port not matched exactly) |
| `http://openbookcorner.jizu.dev:666` | wrong scheme |
| `https://openbookcorner.jizu.dev@evil.com` | userinfo trick |

On any non-match the Worker uses the configured `APP_ORIGIN` (fallback), never
the forwarded value — so a spoof degrades to "normal origin", never to CSRF
bypass.

**Optional defense-in-depth — relay shared secret.** Because origin trust rests
solely on the allow-list, an optional hardening is for Traefik to add a secret
header (e.g. `X-Relay-Token: <random>`) that the Worker verifies before honoring
`X-Forwarded-Origin`. This ties "this request really came via our relay" to a
secret, not just to a well-formed header. Not required for correctness (the
allow-list already blocks spoofed origins) but recommended if the relay path
carries elevated trust later.

**Transport.** Traefik terminates TLS on `:666` and MUST re-dial Cloudflare over
HTTPS with the Worker's real SNI/host (`passHostHeader:false`); never disable
upstream cert verification (would expose session cookies on the middle hop). The
relay upstream MUST stay pinned to the fixed Worker hostname — never derived from
request input (SSRF/open-proxy risk).

**Covers caveat (unchanged).** The relay accelerates the Worker only; R2 cover
images come direct from Cloudflare's CDN and may be slow/blocked in China. If
China-fast covers matter, proxy `/covers/*` through the relay too (or serve
covers from the relayed origin). Out of scope for this ADR; noted for ops.

## Security requirements (non-negotiable)

1. `user.libraryId` (from the session) is the sole isolation source of truth;
   the subdomain only adds a guard.
2. Reserved subdomains (`www/app/admin/api/preview/pr-*`) never resolve as
   tenants.
3. The public branding endpoint exposes only safe fields, validates + rate-limits
   the slug, and is never cached across hosts.
4. **Tenant must be part of every cache key** — both client (TanStack Query keys)
   and any server cache. (The classic subdomain pitfall is a tenant-unaware cache
   serving one tenant's data to another — "the leak I almost shipped".)
5. Cross-tenant / super-admin paths MUST have tests (reject a foreign-tenant user
   on a tenant subdomain; redirect a super admin; reserved-slug resolution).
6. **Proxy/origin trust is an allow-list, never raw header trust.** The Worker
   honors `X-Forwarded-Origin` (from the China relay) ONLY when it matches the
   `APP_ORIGINS` allow-list (exact strings or trusted suffix+port patterns);
   anything else falls back to the configured origin. The `:666` port is part of
   the matched origin. Tests MUST cover: allow-listed forwarded origin accepted;
   unlisted/spoofed forwarded origin ignored (falls back, no CSRF bypass).

## Consequences

**Positive**
- Branded, memorable per-tenant URLs + a recognizable login — the requested UX.
- Near-zero Cloudflare cost: wildcard DNS + wildcard cert already exist; add one
  Worker route.
- Isolation model is unchanged and actually reinforced (per-host cookies + an
  extra subdomain guard on top of `libraryId` scoping).
- The relay/proxy origin handling is designed in (§7), so China-accelerated
  tenant subdomains have a defined, testable path — not an afterthought.

**Negative / costs**
- New **unauthenticated** surface (branding endpoint) → must be minimal, safe,
  rate-limited.
- New **cross-cutting invariant** (tenant in every cache key) → easy to regress;
  needs tests and review discipline.
- **China relay** needs a wildcard Traefik router + a suffix/port allow-list to
  cover tenant subdomains (§7) — more relay config than a single host.
- Slightly more login-flow complexity (apex vs tenant host; super-admin redirect;
  relay-forwarded origin).

## Rollout plan

1. Schema: add `slug` + branding columns to `libraries`; backfill slugs for
   existing libraries; D1 migration.
2. API: public `GET /api/tenant/branding`; extend tenant-admin create/update to
   set slug + branding (super-admin only, slug validation + uniqueness).
3. Worker: Host→tenant resolution + reserved-slug list; add the
   `*.openbookcorner.jizu.dev/*` Worker route; `APP_ORIGIN` already Host-derived.
4. **Proxy/origin support (§7), re-implemented against current main (Hono `hc`):**
   `APP_ORIGINS` allow-list in `env.ts`; Worker honors allow-listed
   `X-Forwarded-Origin` (incl. `:666`); Better Auth `trustedOrigins` = the list;
   generalize to a trusted suffix+port pattern for wildcard subdomains. (This
   supersedes the stale PR #9, which no longer merges after the hc rewrite.)
5. Frontend: branded login by host; apex = standard login; post-auth tenant-match
   guard; super-admin → apex redirect; tenant in all query keys.
6. Tests: cross-tenant rejection, super-admin redirect, reserved-slug resolution,
   branding endpoint safe-fields + rate-limit, **allow-listed vs spoofed
   forwarded-origin**.
7. Relay ops: wildcard Traefik router + `*.cloud.jizu.dev` cert +
   `X-Forwarded-Origin` middleware (configuration, separate from the app PR).
8. Impersonation (if desired): separate audited, read-only, time-boxed feature.

## Alternatives considered

- **Path-based tenants** (`/t/‹slug›`): zero infra, relay untouched — but weaker
  branding, and Cloudflare already makes subdomains cheap, so we chose
  subdomains. (Kept as the fallback if the China-relay wildcard proves costly.)
- **Custom domains per tenant** (`library.acme.com`): most premium, most work
  (per-tenant hostnames + certs via Cloudflare for SaaS). Deferred; subdomains
  first.
- **Super admin logs into any tenant subdomain**: rejected — a cross-tenant login
  bypass is the wrong security shape; use audited impersonation instead.
