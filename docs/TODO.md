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

- [x] Tenant-level "activity" audit page (/admin/activity, 6b99f8d).
  backend ready; no frontend).
- [ ] "Invite / enable login" on a reader detail (attach a `user` to an existing
  `members` row — provision-on-demand per ADR 0006).
- [ ] Reader self-signup matches an existing `members` row (avoid duplicate person).

## Resolved (2026-10-20 UI review)
- [x] Users Role column empty — true root cause: lingui macro `t` passed into a
  plain fn (roleLabel) → empty at runtime. Fixed with in-component <RoleLabel>
  <Trans> (8ef5bad). Also fixed new-signup default role (bcd8972). E2E regression added.
- [x] "impersonate anyone" — canImpersonateUser was a deny-list; empty/unknown
  roles slipped through. Now allow-list (only library_reader) (0b98ea0) + tests.
- [x] Reusable SearchBar + Pager; Users page pagination; clickable overview cards (06e6808).

## Follow-ups (requested, keep ticking)
- [x] **DataTable reuse** — generic DataTable<T> built+tested; Users/Books/Tenants/Audit tables all migrated to it (one quiet table shell). (this commit)
- [x] **Audit log shows names** — listAll enriches actorName/onBehalfOfName/targetName (batched user lookup); audit table shows names, falls back to id. (this commit)
- [ ] Tenant-level "activity" audit page for library admins (listByLibrary ready).
- [x] Reader enable-login (member detail, 1f9a2dc).
- [x] Server-side impersonation guard — only readers (891c789).
  (UI allow-list done; belt-and-suspenders).

## DataTable (ADR 0008) follow-ups
- [ ] Admin Users/Books lists are now **client-side** (fetch up to 200, table does
      sort/search/filter/pagination). Switch back to **server mode**
      (`manualPagination`/`manualSorting`) when any tenant's users or books exceed
      ~200 rows. DataTable already reserves the escape hatches.
- [ ] Wire real **bulk actions** per table (framework + one reference action exist;
      e.g. bulk (de)activate tenants, bulk delete books) against the real APIs.
- [ ] Consider migrating AuditTable (still server-paginated with its own
      tenant/action filters) onto the DataTable toolbar once a server-mode path lands.

## Self-signup + multi-library membership (ADR 0009) — in progress
- [ ] 1. Schema + migration + backfill: `membership`, `user.active_library_id`,
      `libraries.visibility`, `invite`, `join_request`, `join_field`.
- [x] 2. Tenant resolution → active membership (tenant guard) + isolation tests (mw.integration).
- [x] 3. Create-library + post-signup "create or join" welcome + active-library switcher (discover is a placeholder; step 4 fills it in).
- [x] 4. Discover public libraries + request-to-join + admin approval queue.
- [x] 5. Custom join-form builder/renderer + required-field + company-email verification (UI only; full email OTP in Phase 2 / auth plugin).
- [x] 6. Invite links (create/revoke/expiry/max-use) + join-via-invite via token-only URL /join/<token> (QR-able). Auto-join or approval modes.

## Stable-ID links (slug is mutable) — IN PR #21 (ADR 0009)
- [x] Invite links use a token-only URL /join/<token> (no slug/id).
- [x] Tenant login/share link: permanent ID-based URL /t/<libraryId>/login (slug stays as alias); branding resolver accepts id-or-slug. DONE.
      alongside the readable /t/<slug>/login (slug = optional alias; renaming it
      breaks only the alias). Branding resolver accepts id OR slug (try id first).
