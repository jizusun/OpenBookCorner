# ADR 0004: Privileged-action audit log + safe impersonation

- Status: Proposed
- Date: 2026-10-19
- Builds on: ADR 0002 (Better Auth, Drizzle/D1, `hc` API) and ADR 0003 (per-tenant
  subdomains; its §5 defers cross-tenant support to "safe impersonation", which
  this ADR specifies).

## Context

Review of the **current** role/login implementation (2026-10-19) found the
authorization model is sound but two gaps matter for a multi-tenant app.

What is already correct (keep it):

- **Authorization is server-side from the session.** `apps/api/lib/mw.ts` reads
  `role` + `libraryId` from the verified Better Auth session on every request
  (`sessionAuth → tenant → admin → superAdmin`). Role is read fresh per request,
  so a demotion takes effect on the next request without re-login.
- **"View mode" is UI-only.** The admin view switcher (`apps/app/lib/view-mode.ts`,
  `localStorage` `obc-view` = system/admin/reader) is **never sent to or read by
  the API** (verified). Tampering with it changes only what the UI renders, never
  what the server authorizes. It is a *preview of the reader UI*, NOT acting as
  another user: an admin who borrows in "reader view" borrows as **themselves**
  (`c.get('user').id`).

The gaps:

1. **No audit trail for privileged actions.** An admin (or super admin) can add/
   delete books, change library settings, or create/deactivate tenants with **no
   record of who did what, when, in which tenant.** For a multi-tenant system
   this is a compliance and trust gap, and it is the **prerequisite** for any
   impersonation feature.
2. **No real impersonation, but a latent trap.** ADR 0003 §5 needs super admins to
   support tenants without a cross-tenant login bypass. The current "reader view"
   is cosmetic and must not be mistaken for impersonation. A proper, safe
   impersonation feature is needed if/when support-as-user is required.

## Decision

### Part A — Privileged-action audit log (do first; independently valuable)

Add an append-only audit log of privileged actions.

New table `audit_logs` (Drizzle / D1):

| column | type | notes |
| --- | --- | --- |
| `id` | text pk | uuid |
| `actorUserId` | text | who performed it (always the REAL user, even during impersonation) |
| `onBehalfOfUserId` | text, null | set only during impersonation (the impersonated user) |
| `libraryId` | text, null | tenant scope of the action (null for cross-tenant/system ops) |
| `action` | text | e.g. `book.add`, `book.delete`, `library.updateSettings`, `tenant.create`, `tenant.setActive`, `impersonation.start/stop` |
| `targetType` / `targetId` | text, null | the affected entity |
| `metadata` | json, null | small, non-sensitive detail (never secrets/PII beyond ids) |
| `createdAt` | text | ISO timestamp |

Rules:
- **Append-only.** No update/delete of audit rows from the app.
- **Record the REAL actor.** Even during impersonation, `actorUserId` is the
  super admin; `onBehalfOfUserId` is the impersonated user. (Pigment: "the
  audit trail always knows who's really behind the request.")
- **Write at the service/guard layer**, not the UI — so it can't be skipped by a
  direct API call. Admin/superAdmin-guarded mutations emit an audit row.
- **Tenant-scoped reads.** A library admin can see their tenant's audit log; a
  super admin can see system-level entries. Never cross-tenant.
- Start with the existing privileged mutations (book add/update/delete, settings
  update, tenant create/set-active); extend as new ones are added.

### Part B — Safe impersonation (only if/when support-as-user is needed)

If a super admin must see/act as a tenant user, implement it per best practice
(Pigment "Impersonation Done Right"), NOT as a login bypass:

1. **Separate, short-lived session.** Starting impersonation mints a **new,
   distinct session/token** (~30 min expiry), stored separately from the admin's
   own session; ending it reverts cleanly. Do not flip a flag on the existing
   session.
2. **Read-only by default.** Impersonation is for *observing*. Mutations are
   **rejected in middleware** (not just hidden in the UI) with a clear 403 +
   response header the frontend surfaces. A build-time/test check asserts every
   mutating endpoint is explicitly allowed-or-denied under impersonation.
3. **Scoped to the impersonator's reachable access.** A super admin may only
   impersonate within tenants they administer; the session is the intersection of
   both identities' access, never a union.
4. **Full audit trail.** `impersonation.start` / `impersonation.stop` + every
   observed-but-blocked mutation attempt are logged (Part A), visible to the
   tenant.
5. **Persistent on-screen banner** for the entire session ("System admin —
   viewing ‹tenant› as ‹user›"), so the admin never forgets they are impersonating.

Impersonation is **out of scope until explicitly prioritized**; Part A does not
depend on it.

#### Part B — as implemented (v1)

Part B was prioritized and shipped on top of **Better Auth's `admin` plugin**
(`impersonateUser` / `stopImpersonating`), rather than hand-rolled sessions:

- **Separate, short-lived session (1).** The admin plugin mints a distinct
  impersonation session with `session.impersonatedBy` = the real super-admin id,
  time-boxed to **30 min** (`impersonationSessionDuration`), and
  `stopImpersonating` restores the admin's own session. ✔
- **Scoped / least-privilege (3).** `adminRoles: ['super_admin']` — only super
  admins may impersonate; the plugin refuses to impersonate another admin
  (`allowImpersonatingAdmins` left false). The UI action (`canShowImpersonateAction`)
  is super-admin-only, never self, and only for members with a linked login. ✔
- **Full audit trail (4).** `databaseHooks.session.create/delete.after` write
  `impersonation.start` / `impersonation.stop` rows server-side (real actor +
  `onBehalfOfUserId`, scoped to the target's tenant so that tenant sees it). ✔
- **Persistent on-screen banner (5).** `ImpersonationBanner` (role=status,
  sticky) shows for the whole session with a **"Back to my account"** exit (not
  "Sign out"). ✔
- **Read-only by default (2) — DEFERRED.** v1 grants **full access** as the
  impersonated user (Better Auth's built-in behavior). Mutations are NOT yet
  blocked in middleware. The compensating control is the complete, tenant-visible
  audit trail (every action is attributed to the real super admin via
  `actorUserId`). Middleware-enforced read-only is tracked as a follow-up
  hardening — see the checklist below.

> Deliberate deviation: the team chose full-access impersonation for v1 to ship
> the support-as-user capability with its audit trail; read-only enforcement is
> the next hardening step, not a blocker.

### Part C — Small defensive improvements (not architectural; land as code)

These are implementation hygiene, listed here for completeness but shippable
without an ADR:

- **Least-privilege view default:** `view-mode.ts` `read()` defaults to `'reader'`
  (not `'admin'`); UI gates derive from role AND view, never view alone.
- **Rename "reader view" → "Reader preview"** in code/UI/docs to prevent anyone
  mistaking it for impersonation.
- **Login rate-limiting:** enable Better Auth `rateLimit` (brute-force
  protection), with stricter handling for admin/super-admin — especially given
  the internet-reachable China relay.
- **Test:** assert a role change (admin→reader) takes effect on the **next
  request** without re-login (locks in the "role read fresh per request" property).

## Security requirements (non-negotiable)

1. Audit log is **append-only** and written **server-side at the guard/service
   layer** (cannot be bypassed by a direct API call).
2. Audit `actorUserId` is always the **real** user; impersonation adds
   `onBehalfOfUserId`, never overwrites the actor.
3. Audit reads are **tenant-scoped** (admin sees own tenant; super admin sees
   system). No cross-tenant audit visibility.
4. Impersonation (if built) is **read-only by default, enforced in middleware**,
   **time-boxed**, **separately-sessioned**, **access-scoped**, **audited**, and
   **visibly banner-ed**.
5. Metadata stores only ids / non-sensitive fields — never secrets, tokens, or
   PII beyond identifiers.

## Consequences

**Positive**
- A real audit trail for privileged/multi-tenant actions (compliance + trust).
- Unblocks ADR 0003 §5's "safe impersonation" with a correct foundation.
- Clears the "reader view = impersonation" misconception.

**Negative / costs**
- New table + write-path in every privileged mutation (small, but cross-cutting).
- Impersonation (Part B) is genuinely complex and security-sensitive; kept
  deferred and optional on purpose.

## Rollout plan

1. **Part A:** `audit_logs` schema + D1 migration; emit audit rows from the
   existing admin/superAdmin mutations; tenant-scoped read endpoint + a simple
   admin "Activity" view; tests (row written on mutation; tenant-scoped reads;
   append-only).
2. **Part C:** the defensive code wins (view default, rename, rate-limit, role-
   change test) — can land in the same or a follow-up PR.
3. **Part B (impersonation):** only when prioritized; separate PR with its own
   read-only-enforcement + endpoint tagging + tests.

## Alternatives considered

- **UI-only audit (log from the client):** rejected — trivially bypassed by a
  direct API call; audit MUST be server-side.
- **Super admin logs into any tenant subdomain (reuse the session):** rejected
  (see ADR 0003) — a cross-tenant login bypass; use scoped, audited impersonation.
- **Do nothing (status quo):** acceptable short-term since authz is already
  server-side, but leaves the compliance/trust gap and blocks impersonation.
