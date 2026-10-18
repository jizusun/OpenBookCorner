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

> **China relay caveat.** The Traefik relay (`obc.cloud.jizu.dev:666`, see the
> relay work) currently fronts a single host. To accelerate tenant subdomains in
> China it needs a **wildcard Traefik router** + the existing `*.cloud.jizu.dev`
> wildcard cert. This is a **follow-up**, tracked below — it does not block the
> Cloudflare-side rollout.

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
with the existing `APP_ORIGINS` allow-list used for the China relay.

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

## Consequences

**Positive**
- Branded, memorable per-tenant URLs + a recognizable login — the requested UX.
- Near-zero Cloudflare cost: wildcard DNS + wildcard cert already exist; add one
  Worker route.
- Isolation model is unchanged and actually reinforced (per-host cookies + an
  extra subdomain guard on top of `libraryId` scoping).

**Negative / costs**
- New **unauthenticated** surface (branding endpoint) → must be minimal, safe,
  rate-limited.
- New **cross-cutting invariant** (tenant in every cache key) → easy to regress;
  needs tests and review discipline.
- **China relay** needs a wildcard Traefik router to cover tenant subdomains
  (follow-up).
- Slightly more login-flow complexity (apex vs tenant host; super-admin redirect).

## Rollout plan

1. Schema: add `slug` + branding columns to `libraries`; backfill slugs for
   existing libraries; D1 migration.
2. API: public `GET /api/tenant/branding`; extend tenant-admin create/update to
   set slug + branding (super-admin only, slug validation + uniqueness).
3. Worker: Host→tenant resolution + reserved-slug list; add the
   `*.openbookcorner.jizu.dev/*` Worker route; `APP_ORIGIN` already Host-derived.
4. Frontend: branded login by host; apex = standard login; post-auth tenant-match
   guard; super-admin → apex redirect; tenant in all query keys.
5. Tests: cross-tenant rejection, super-admin redirect, reserved-slug resolution,
   branding endpoint safe-fields + rate-limit.
6. China relay: wildcard Traefik router + `*.cloud.jizu.dev` cert (separate PR).
7. Impersonation (if desired): separate audited, read-only, time-boxed feature.

## Alternatives considered

- **Path-based tenants** (`/t/‹slug›`): zero infra, relay untouched — but weaker
  branding, and Cloudflare already makes subdomains cheap, so we chose
  subdomains. (Kept as the fallback if the China-relay wildcard proves costly.)
- **Custom domains per tenant** (`library.acme.com`): most premium, most work
  (per-tenant hostnames + certs via Cloudflare for SaaS). Deferred; subdomains
  first.
- **Super admin logs into any tenant subdomain**: rejected — a cross-tenant login
  bypass is the wrong security shape; use audited impersonation instead.
