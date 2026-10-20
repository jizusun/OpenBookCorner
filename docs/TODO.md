# OpenBookCorner — Working TODO

Persistent checklist for the PR #18/#19 super-admin + onboarding + audit work.
Branch: `feat/impersonation`. Tick items as they land (commit hash in parens).

## In progress

- [ ] **Audit task 2** — `AuditService.listAll` global/paginated/filterable +
  `GET /api/admin/audit` (super-admin) + integration. Backend DONE (service +
  route + api proxy + 4 integration green); FRONTEND page not yet switched.
- [x] Audit page: global admin.audit + tenant/action filters + pagination (626ad06)
- [ ] **Audit task 4** — full verify + E2E (borrow → appears in super-admin
  audit, filterable) + commit + push + CI/Preview green.

## Overview drill-down + missing Books page (steer 2026-10-20)

- [x] **Overview stat cards clickable** (aebee74)
- [ ] **Super-admin should have 3 list pages**: tenants (have), users (have),
  **all books across the system (MISSING)** — build `/admin/books` global book
  list (super-admin, cross-tenant, paginated/searchable) + `GET /api/admin/books`.
- [x] Overview wired to /admin/tenants|users|books (aebee74)

## Bugs found (to fix)

- [x] **Users page: Role column empty** — ROOT CAUSE: Better Auth admin plugin
  assigned its own default role `"user"` to sign-ups, overriding our
  `library_reader` default (outside our role set → empty label / no impersonate).
  FIX: `admin({ defaultRole: 'library_reader' })`. Verified new sign-ups now get
  `library_reader`. (commit pending)
- [x] **One-off data fix** — preview D1 verified CLEAN (0 role=user/NULL; 3 admin/2 reader/1 super). Added idempotent backfill to seed-users.sh (UPDATE user SET role='library_reader' WHERE role IS NULL OR role='user') so CI self-heals any residue.
- [ ] **Users page: impersonate button only on some rows** — resolved by the
  role fix; admins/super/self correctly have no button. (verify after deploy)
- [x] **Tenant detail: section/label mismatch** — FIXED: detail now lists Users (accounts) via admin.users?libraryId, header 'Users', 'Add admin' creates a user, impersonate via canImpersonateUser. (16d7f85)

## Done (recent)

- [x] Member→Reader / Users wording + userCount/readerCount split (e1641c4)
- [x] ADR 0005 audit architecture (00df1be)
- [x] Audit borrow/return + AGENTS "write ADRs proactively" (571368b)
- [x] ADR 0006 user-vs-reader (committed with this TODO)
- [x] Tenant onboarding (admin/reader) backend + UI (15f9d06, 83228d3)
- [x] Super-admin console 5 pages + view-switch retirement + tenant list refactor/drill-down

## Later / deferred

- [ ] Tenant-level "activity" audit page for library admins (`listByLibrary`
  backend ready; no frontend).
- [ ] "Invite / enable login" on a reader detail (attach a `user` to an existing
  `members` row — provision-on-demand per ADR 0006).
- [ ] Reader self-signup matches an existing `members` row (avoid duplicate person).
