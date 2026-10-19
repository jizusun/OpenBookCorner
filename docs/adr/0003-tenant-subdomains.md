# ADR 0003: Path-based multi-tenancy (`/t/:slug`) with customized login

- Status: Accepted
- Date: 2026-10-19
- Builds on: ADR 0002 (Bun monorepo, Better Auth, Drizzle/D1, Hono `hc`).
- History: an earlier draft of this ADR proposed **tenant subdomains**
  (`acme.openbookcorner.jizu.dev`). We changed to **path-based** tenancy after
  weighing the TLS/DNS cost and complexity (see "Alternatives considered").

## Context

Each library (tenant) should have its own URL and a **customized login page**
(name, logo, brand color, welcome text). Isolation today is enforced in the API
by scoping every query to the session's `libraryId` (`apps/api/lib/mw.ts`:
`sessionAuth → tenant → admin → superAdmin`).

Subdomains (`acme.openbookcorner.jizu.dev`) would give each tenant a branded
host, but the preview environment needs tenants too (`…/preview/…`), and a
two-level preview wildcard (`*.preview.openbookcorner.jizu.dev`) is **not
covered by free Universal SSL** and would require **Advanced Certificate Manager
($10/mo)** or per-hostname **Cloudflare for SaaS** registration. We verified the
zone is on the **Free plan with no ACM**. We want **zero cost and low
complexity**.

## Decision

**Tenants live in the URL path: `/t/:slug/...`** (e.g. `/t/acme/login`,
`/t/acme/books`), on the single existing origin(s) — production
`openbookcorner.jizu.dev` and preview `preview.openbookcorner.jizu.dev`.

### 1. Why path-based (the KISS win)

- **One origin, one cert.** Everything stays under the existing, already-covered
  hosts. **No new DNS, no wildcard cert, no ACM, no Cloudflare-for-SaaS, no
  per-hostname registration.** The entire TLS problem disappears.
- **Preview multi-tenancy just works**: `preview.openbookcorner.jizu.dev/t/acme`
  — no two-level host, no new cert.
- **One cookie scope.** Better Auth cookies work across all `/t/:slug/...` paths;
  no per-subdomain session juggling, and `APP_ORIGIN` stays simple.

### 2. Auth & isolation: the path slug is NOT a security boundary

Authentication and isolation come **only** from the Better Auth session:

- **Authentication:** Better Auth session cookie. The slug is never used to
  authenticate.
- **Isolation:** the `tenant` middleware reads `user.libraryId` from the verified
  session and scopes every query to it. API calls are same-origin `/api/*`
  (no `/t/:slug` prefix), so the slug never reaches the API — and would be
  ignored for authz if it did.
- The slug is used server-side in exactly ONE place: the public branding
  endpoint (`?slug=`), pre-auth, returning safe fields only.

Consequence: a user editing the URL from `/t/acme` to `/t/beta` gains nothing —
the API still returns only their own library's data (from the session), and a
client guard (below) bounces them back. The URL cannot escalate access.

### 3. Resolution + validation

`resolveTenantPath(pathname)` (pure, unit-tested) extracts the slug from the
first `/t/:slug` segment and validates it with `isValidSlug` (2–40 chars,
`^[a-z0-9-]+$`, no leading/trailing hyphen, not a reserved word like
`admin/api/login/preview`, not `pr-N`). Invalid/absent → null (standard,
non-tenant app).

### 4. Customized login

`libraries` carries `slug` (unique) + `logoUrl` / `brandColor` / `loginWelcome`.
The public, unauthenticated `GET /api/public/branding?slug=` returns ONLY those
safe fields (rejects reserved/invalid slugs; inactive tenants → not found). The
login page at `/t/:slug/login` reads the slug from the path and renders that
tenant's branding; the plain `/login` (no slug) shows the standard login.

### 5. Super admin

Super admins use the **non-tenant app** (`/login` → `/admin/tenants`, system
view) and manage all libraries via `superAdminProcedure` (not tenant-scoped). A
super admin who opens a `/t/:slug` URL is redirected by the client to the system
view — never a silent cross-tenant login.

### 6. Client-side tenant guard (UX, not security)

The `/t/:slug` layout's `beforeLoad` compares the path slug to the session's
tenant; a mismatch redirects the user to their own tenant (or shows "wrong
library"). This is a convenience/UX guard only — the server already refuses
cross-tenant data regardless.

### 7. China relay + proxy/origin allow-list (unchanged, still applies)

The Traefik relay (`obc.cloud.jizu.dev:666`) fronts the Worker for China
latency. Because it presents a different public origin, the Worker honors
`X-Forwarded-Origin` **only** when it matches the `APP_ORIGINS` allow-list
(`isAllowedOrigin`: anchored URL parse — scheme `https`, dot-anchored host
suffix, exact port incl. `:666`; rejects suffix/prefix/port/userinfo confusion).
An unlisted/spoofed value falls back to `APP_ORIGIN` — never a CSRF/origin
bypass. Path-based tenancy composes cleanly here: the relay forwards one origin
regardless of which `/t/:slug` path the browser is on.

## Security requirements (non-negotiable)

1. `user.libraryId` (from the session) is the SOLE isolation source of truth; the
   path slug is branding + UX only, never trusted for authz.
2. The public branding endpoint exposes only safe fields, validates the slug, and
   is not cached across tenants.
3. Tenant must be part of every client cache key (TanStack Query) to avoid a
   tenant-unaware cache serving another tenant's data.
4. Proxy/origin trust is an allow-list (`APP_ORIGINS`), never raw header trust;
   spoofed `X-Forwarded-Origin` falls back, with tests.

## Consequences

**Positive**: zero TLS/DNS/cert cost or complexity; preview multi-tenancy works
for free; one cookie scope; no server-side host guard needed (API is
session-scoped); minimal churn.

**Negative**: less "branded" than a subdomain (tenant is a path segment, not a
host). Mitigated by the per-tenant branded login + theming by slug.

## Rollout plan

1. Schema: `slug` + branding columns on `libraries` (migration 0007). ✓
2. API: public `GET /api/public/branding?slug=`; keep audit log (ADR 0004). ✓
3. Pure helper `resolveTenantPath` + `isValidSlug` (unit-tested). ✓
4. Frontend: `/t/:slug/login` branded login by slug; client slug-vs-session
   guard on the `/t/:slug` layout; non-tenant app for super admin.
5. Seed two demo tenants (`acme`, `globex`) with demo users to exercise it.
6. Relay/origin allow-list retained (§7).

## Alternatives considered

- **Tenant subdomains** (`acme.openbookcorner.jizu.dev`): more "branded", and the
  Cloudflare wildcard DNS already exists — BUT preview tenants
  (`acme.preview.openbookcorner.jizu.dev`) are two levels deep and need **ACM
  ($10/mo)** or per-hostname **Cloudflare for SaaS** registration; subdomains
  also complicate cookies/origin and the China relay (per-host). **Rejected** for
  cost + complexity vs. path-based.
- **Vanity domains** (`library.acme.com`): premium; needs Cloudflare for SaaS +
  per-hostname certs. Deferred; path-based does not preclude adding this later.
- **ACM wildcard for a preview base**: $10/mo recurring for preview polish.
  Rejected — stay free.
