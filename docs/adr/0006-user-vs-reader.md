# 0006 — User vs Reader: concepts, when to use which, and how it's wired

- Status: Accepted
- Date: 2026-10-20
- Context for: the recurring confusion between "user" and "member/reader" across
  the admin UI (tenant counts, members page, onboarding, impersonation).

## Context

Two distinct kinds of "person" exist in the system and were being conflated in
the UI (both shown as "Member/成员"), producing contradictions like a tenant
showing "2 members" in the list but "0" in its detail. This ADR fixes the
concepts, states when each is used, and records how the code actually wires them
(verified against the schema + services, not aspirational).

## The two concepts

### User (login account)
- **Definition**: a Better Auth account that can **sign in**.
- **Table**: `user` (Better Auth), extended with `libraryId` + `role`.
- **Role**: `user.role ∈ { super_admin, library_admin, library_reader }`.
- **Has**: email (unique) + password hash. Exactly the people who use the app.
- **Scope**: `super_admin` is system-level (no tenant); `library_admin` /
  `library_reader` belong to one `libraryId`.

### Reader (library roster entry; table name `members`)
- **Definition**: a **person in a library's roster** who may borrow — and who
  **may or may not have a login account**. This is the standard ILS "patron"
  model (a patron is not required to have credentials).
- **Table**: `members` (name kept for migration safety; the UI says "Reader/读者").
- **Role**: `members.role ∈ { library_admin, library_reader }`.
- **Origin**: mostly **番薯 import** (historical borrowers, usually no email/
  account). May be linked to a `user` via `members.userId` when the person also
  has a login.

### Relationship
`members.userId → user.id` (nullable). A person with a login has BOTH a `user`
and a `members` row, linked. A historical borrower has only a `members` row.

## When to use which (UI rules)

| Surface / question | Use | Why |
|---|---|---|
| "Who can sign in / has what role" | **User** | only accounts have roles/login |
| Super-admin tenant list / overview / tenant-detail headline count | **User** (`userCount`) | super admin asks "who uses the system" |
| Global user directory `/admin/users`, role/impersonation | **User** | accounts only |
| Impersonation target | **User** | only an account can be impersonated |
| Library roster / borrow management / overdue | **Reader** (`members`) | includes account-less historical borrowers |
| Tenant-detail roster section + its count (`readerCount`) | **Reader** | the library's people |

Rule of thumb: **"login / permission / impersonate" → User; "roster / borrowing
/ patron management" → Reader.** The word "Member/成员" is retired from the UI;
only **User/用户** and **Reader/读者** appear.

## How borrowing is wired (verified)

`borrowTransactions` has BOTH foreign keys, by design:
- `userId → user.id` — used by **in-app borrowing** (`CirculationService.borrow`
  writes `userId`; `myBooks`, limits, overdue all key off `userId`).
- `memberId → members.id` — used by **番薯 import** (`transformLoans` writes
  `memberId`, because historical borrowers have no account).

Consequence: an app-borrow and an imported historical loan live on different
columns. In-app reader views (`myBooks`) intentionally only show the signed-in
user's `userId` loans — account-less historical borrowers never sign in, so this
is correct, not a bug.

## Onboarding (how a Reader gets a login)

`createTenantUser` (ADR: onboarding) creates a `user` AND a linked `members` row
(same libraryId + role), so an onboarded admin/reader is simultaneously an
account and a roster entry. Import creates `members` only; a future
"invite / enable login" flow will attach a `user` to an existing `members` row
(provision-on-demand), rather than importing accounts directly — matching ILS
and SaaS practice (import rosters, invite to activate).

## Consequences

- Counts are unambiguous: `userCount` (accounts) vs `readerCount` (roster).
- The super-admin console speaks only "Users"; the library roster speaks
  "Readers". No "Member" in the UI.
- Do NOT create `user` rows at import time (no credentials; would create zombie
  accounts). Keep `members` as the account-less patron record.
- The dual FK on `borrowTransactions` is intentional; keep both paths.

## Verification notes (checked while writing this ADR)

- `db/schema/auth.ts`: `user.role` default `library_reader`; `user` has tenant
  fields.
- `db/schema/domain.ts`: `members.role` enum admin/reader; `members.userId`
  nullable FK to `user`; `borrowTransactions` has both `userId` and `memberId`.
- `apps/api/services/index.ts`: `borrow()` writes `userId` only; `myBooks` keys
  off `userId`.
- `fanshuTransform`/`fanshuImport`: loans written with `memberId`.
- `TenantAdminService.listAll`/`getById`: `userCount` counts `user`,
  `readerCount` counts `members` (per ADR 0005 UI work).
