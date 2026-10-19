# Super-Admin Console — Design

Status: Proposed
Supersedes: nothing (extends ADR 0004 Part B — impersonation)
Audience: engineers implementing the super-admin surface of OpenBookCorner

## 1. Problem & context

OpenBookCorner is a multi-tenant library PWA. A **super admin** is a system-level
operator who spans all tenants (libraries). Today the super admin has exactly
**one** dedicated page — the **Tenants** list — reachable only in the "System"
view. Everything else a super admin can open (members, catalog, settings, …)
belongs to the *Admin/Reader* views and is scoped to the **single** library the
super admin happens to be attached to (`user.library_id`). There is:

- no way to drill into a tenant to see its members,
- no cross-tenant view of all users,
- no UI for the system audit log (the backend already records it),
- no system-level overview or settings.

As a direct consequence, **impersonation (ADR 0004 Part B) is unreachable in
practice**: a super admin has no screen that lists the users they could
impersonate across tenants.

Industry super-admin / platform consoles converge on a small, well-known set of
pages: an **overview dashboard**, **tenant management (with drill-down)**,
**user management (with impersonation)**, **audit logs**, and **settings**
(billing/RBAC/feature-flags are common too but out of scope here — Phase 1 has no
billing, fixed roles, and no feature flags). This document specifies that console
for OpenBookCorner, scoped to what is valuable now.

## 2. Goals / non-goals

**Goals**
- Give the super admin a coherent, two-level console: system-wide pages plus
  tenant drill-down.
- Make impersonation reachable from two natural places (global user list and a
  tenant's member list), reusing the existing `MemberImpersonateButton`,
  `ImpersonationBanner`, 30-min time-box, and server-side audit.
- Surface the already-recorded system audit log.
- Keep it an **internal operational tool**: functional and reliable over polished.

**Non-goals (Phase 1)**
- Billing / subscriptions (dropped from the stack).
- RBAC editing / custom roles (roles are fixed: super_admin / library_admin /
  library_reader).
- Feature flags, background-job dashboards, system health/metrics.
- **Writable** system settings (settings page is **read-only** for now).
- Read-only *enforcement* of impersonation (tracked as ADR 0004 follow-up; the
  audit trail is the compensating control).

## 3. Information architecture

System view navigation (super admin only):

```
[ Overview ]   /admin/overview       dashboard: key counts + recent activity
[ Tenants  ]   /admin/tenants        list → (drill-down) tenant detail
[ Users    ]   /admin/users          ALL users across tenants + impersonate
[ Audit    ]   /admin/audit          system-level action log
[ Settings ]   /admin/system         read-only system information
```

Notes:
- The existing `/admin/settings` is **tenant-level** library settings; the
  system settings page uses a distinct route (`/admin/system`) to avoid
  collision.
- All five routes are guarded `super_admin` only (`beforeLoad` → redirect to
  `/books` otherwise), matching the existing `tenants.tsx` guard.
- Navigation: the System-view `navItems` in `routes/_app/route.tsx` gains the
  five entries (today it has only `Tenants`).

## 4. Pages

### 4.1 Overview — `/admin/overview`

Landing page for the super admin ("situational awareness at a glance").

Content:
- **Stat cards**: tenant count, total users, total books, active loans.
- **Recent system activity**: latest ~5 audit entries (links to full Audit page).
- **Per-tenant snapshot**: each tenant with user/book counts + active flag
  (links to the tenant detail page).

Backend: one aggregate endpoint
`GET /api/admin/overview` (super-admin) returning
`{ counts: { tenants, users, books, activeLoans }, recentAudit: AuditRow[],
tenants: TenantSummary[] }`. Implemented as a thin service composing existing
queries (tenant list already returns `bookCount`/`memberCount`; audit via
`listSystem({ limit: 5 })`).

Priority: last (pure aggregation; depends on the other data being available).

### 4.2 Tenants — list + detail

**List** (`/admin/tenants`, refactor of the current page):
- Search box; **Create tenant** moved into a dialog (today it is an always-on
  form that dominates the page).
- Each row: name · `/t/slug` · active badge · *N members · M books* · **Enter →**.
- Per-row inline Edit/Deactivate/Delete are **moved into the detail page** so the
  list stays a clean, scannable list.

**Detail** (`/admin/tenants/$libraryId`, **new**):
```
← Back to tenants
Acme Library   ● Active   /t/acme   [Copy login link]
[ Overview ] [ Members ]
〈Overview〉 domains · members · books · created-at   [Edit][Deactivate][Delete]
〈Members〉  read-only member list of THIS tenant;
            rows with a linked account show [Sign in as them]
```
- The Members sub-view is one of the two impersonation entry points.
- Reuses `MemberImpersonateButton` (visibility: super_admin, not self, not
  another admin, member has a linked login account).

Backend (new, super-admin guarded):
- `GET /api/tenant/:libraryId` — single-tenant summary (name, slug, domains,
  active, counts, createdAt). May reuse `TenantAdminService.listAll()` filtered,
  or a dedicated `getById`.
- `GET /api/tenant/:libraryId/members` — members of an **arbitrary** tenant
  (by **path** libraryId). This is distinct from the existing `GET /api/member`
  which is isolated to the **session** libraryId; a super admin needs to read
  **other** tenants, so this endpoint takes the id from the path and is
  super-admin guarded. Returns the same read shape plus `userId` (needed to
  decide impersonability).

### 4.3 Users (global) — `/admin/users`

A flat, cross-tenant list of **all login users** — the industry-standard "user
management" surface and the second impersonation entry point.

```
All users                         [search name/email…]
Name    Email            Tenant   Role     Actions
张三    zhang@acme.com   Acme     Reader   [Sign in as them]
李四    li@acme.com      Acme     Admin    —(admins can't be impersonated)
王五    w@globex.com     Globex   Reader   [Sign in as them]
Super   super@…          —        Super    —(yourself)
                                           [Load more]
```

- Lists Better Auth `user` rows (login accounts), **not** `members` (番薯 import
  records). Impersonation only works on a real login account, so `user` is the
  correct source for a global people-finder. (The tenant-detail Members view,
  by contrast, lists `members` and offers impersonate only where a `userId` link
  exists — the two views are complementary: global search vs. per-tenant browse.)
- Columns: name, email, resolved tenant name, role, action.
- Reuses the `canShowImpersonateAction(viewerRole, targetUserId, viewerId)`
  rule; admins and self are not impersonable (also enforced server-side by the
  admin plugin).

Backend (new): `GET /api/admin/users` (super-admin), paginated, searchable by
name/email, joining `user.library_id → libraries.name`. There is currently no
cross-tenant user service — this must be added (tenant-scoped queries elsewhere
must remain unchanged; this endpoint is explicitly system-level and guarded).

### 4.4 Audit — `/admin/audit`

```
System audit log               [filter by action ▾]
Time          Actor   Action               Target
10-19 14:03   Super   impersonation.start  张三
10-19 14:10   Super   impersonation.stop   张三
10-19 13:50   Super   tenant.create        Globex
```

- **Backend already exists**: `GET /api/tenant/audit` → `AuditService.listSystem()`
  (system-level rows where `library_id IS NULL`). This page is **frontend-only**.
- Shows actor (the real super admin — never the impersonated user), action,
  target, timestamp; `onBehalfOfUserId` shown where present.
- Optional enhancement: client-side or server-side filter by `action` (the
  service already has `listByLibraryAction`; a `listSystemAction` analogue can be
  added if needed).
- Highest value / lowest risk / fastest to ship — makes "every impersonation is
  recorded" actually visible.

### 4.5 System settings (read-only) — `/admin/system`

There is **no system-settings storage today** (settings live per-library on
`libraries.settings`). Per decision, this page is **read-only system
information** — zero new tables, shippable immediately:

- Environment (development / preview / production) and app name.
- App version / build (if available).
- Tenancy model summary (path-based `/t/:slug`), and where tenant-level settings
  live (pointer to each tenant's detail → Edit).
- Demo-account visibility state (derived from environment).

Explicitly **not** writable in this iteration. If/when writable system settings
are needed, a follow-up adds a `system_settings` table + read/write endpoints;
this page is the natural home for them later.

## 5. Impersonation integration (recap)

Already built (ADR 0004 Part B, PR #19) and reused here unchanged:
- Better Auth admin plugin: `impersonateUser` / `stopImpersonating`,
  `session.impersonatedBy`, super_admin-only, cannot impersonate admins/self,
  30-min time-box.
- Server-side audit of `impersonation.start` / `impersonation.stop`
  (real actor + `onBehalfOfUserId`, scoped to the target tenant).
- `ImpersonationBanner` (sticky, role=status) with a **"Back to my account"**
  exit, mounted in the `_app` layout.
- `MemberImpersonateButton` + `canShowImpersonateAction` visibility rule.

Entry points in this console:
1. **Users (global)** — pick anyone across tenants.
2. **Tenant detail → Members** — browse a specific tenant's members.

## 6. Backend surface summary

| Endpoint | Status | Guard | Notes |
|---|---|---|---|
| `GET /api/tenant` (list) | exists | super-admin | tenant list w/ counts |
| `GET /api/tenant/audit` | **exists** | super-admin | system audit (Audit page) |
| `GET /api/tenant/:id` | new | super-admin | single-tenant summary |
| `GET /api/tenant/:id/members` | new | super-admin | members of ANY tenant (path id) |
| `GET /api/admin/users` | new | super-admin | all users, paginated, searchable |
| `GET /api/admin/overview` | new | super-admin | aggregate counts + recent audit |
| `POST /api/auth/admin/impersonate-user` | exists | super-admin | admin plugin |
| `POST /api/auth/admin/stop-impersonating` | exists | — | admin plugin |

All new endpoints are **system-level and super-admin guarded**; existing
tenant-scoped endpoints (isolated by session `libraryId`) are left unchanged so
multi-tenant isolation is never weakened.

## 7. Frontend surface summary

| Route | Status | Notes |
|---|---|---|
| `/admin/overview` | new | dashboard |
| `/admin/tenants` | refactor | list only; create→dialog; row→detail |
| `/admin/tenants/$libraryId` | new | overview + members (impersonate) |
| `/admin/users` | new | global users + impersonate |
| `/admin/audit` | new | system audit (backend ready) |
| `/admin/system` | new | read-only system info |

System-view `navItems` gains the five entries. `MemberImpersonateButton` /
`ImpersonationBanner` reused. New copy is translated to zh (CI enforces
catalogs-in-sync & fully-translated).

## 8. Build order (value / risk)

1. **Audit log page** — backend ready, frontend-only, highest value / lowest risk.
2. **Global users page** (+ `GET /api/admin/users`) — the primary impersonation
   entry point.
3. **Tenant detail** (+ `GET /api/tenant/:id`, `/:id/members`) — drill-down +
   per-tenant impersonation; refactor the list.
4. **Overview** (+ `GET /api/admin/overview`) — aggregation; ties pages together.
5. **System settings (read-only)** — zero new storage.

Each page: present the full test plan across the pyramid (unit ≫
integration/component ≫ E2E) BEFORE coding, TDD red→green, i18n translated,
whole suite + CI + Preview green. Atomic conventional commits; likely one PR per
page (or grouped), built on the merged impersonation baseline (PR #19).

## 9. Testing strategy (per page, high level)

- **Unit (majority)**: pure helpers (visibility/formatting), service classes with
  the sql.js test DB (new cross-tenant user service, overview aggregation,
  single-tenant/members reads), audit row shaping.
- **Integration**: hc handlers + guards via the test harness — each new endpoint's
  super-admin guard matrix (super-admin 200; library_admin/reader 403; anon 401)
  and cross-tenant read correctness.
- **Component**: each new page renders rows/cards; impersonate action visibility
  matrix; empty/loading states.
- **E2E (fewest)**: one path per impersonation entry point
  (System → Users → impersonate → banner → exit; System → Tenants → tenant →
  Members → impersonate → exit) and the Audit page showing start/stop.

## 10. Open questions

- **Overview stat "active loans"**: cheap to compute cross-tenant? If costly,
  drop it from v1.
- **Users page scale**: pagination is required; default page size 50, search by
  name/email. Do we need tenant/role filters in v1 or later?
- **System settings**: confirmed read-only for now; revisit when a concrete
  writable setting is needed.
