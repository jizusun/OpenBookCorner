# OpenBookCorner — Working TODO

Persistent checklist for the PR #18/#19 super-admin + onboarding + audit work.
Branch: `feat/impersonation`. Tick items as they land (commit hash in parens).

## In progress

- [ ] **Audit task 2** — `AuditService.listAll` global/paginated/filterable +
  `GET /api/admin/audit` (super-admin) + integration. Backend DONE (service +
  route + api proxy + 4 integration green); FRONTEND page not yet switched.
- [ ] **Audit task 3** — Audit page `/admin/audit` → data source `admin.audit`
  (global), add tenant/action filters + pagination; component tests + i18n.
- [ ] **Audit task 4** — full verify + E2E (borrow → appears in super-admin
  audit, filterable) + commit + push + CI/Preview green.

## Overview drill-down + missing Books page (steer 2026-10-20)

- [ ] **Overview stat cards clickable** — Tenants/Users/Books numbers on
  `/admin/overview` should each link to the corresponding list page.
- [ ] **Super-admin should have 3 list pages**: tenants (have), users (have),
  **all books across the system (MISSING)** — build `/admin/books` global book
  list (super-admin, cross-tenant, paginated/searchable) + `GET /api/admin/books`.
- [ ] Wire overview: Tenants→/admin/tenants, Users→/admin/users, Books→/admin/books.

## Bugs found (to fix)

- [ ] **Users page: Role column empty** — `/admin/users` shows blank Role for
  every row. Backend selects `user.role`; UI renders `roleLabel(u.role)`.
  Suspect: preview DB rows have empty/null `role` (seed path). NEED to confirm
  actual `user.role` values in preview D1 (blocked: wrangler needs
  CLOUDFLARE_API_TOKEN; use `cf` OAuth or seed-users path). Then fix root cause
  (seed sets role, or UI/back-end default).
- [ ] **Users page: impersonate button only on some rows** — EXPECTED for
  admins/super (not impersonable) + self; but verify it's role-driven and not a
  side effect of the empty-role bug. Tie to the Role-empty fix.
- [ ] **Tenant detail: section/label mismatch** — the "Readers" section header
  sits above an **"Add admin"** button and "No readers" empty state. Adding an
  admin creates a USER (account), shown under a READER roster section → confusing.
  Rework: separate "Add admin" (account) from the reader roster, or relabel.

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
