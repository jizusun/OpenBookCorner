# ADR 0009: Self-signup, multi-library membership, and join/approval flow

## Status

Proposed — supersedes the single-library assumptions in ADR 0006 (user vs
reader) and the email-domain auto-assignment implied by `libraries.emailDomains`.
This ADR defines the data model + flows; implementation lands incrementally on
the same branch/PR behind the design.

## Context

Today a user is bound to exactly one library: the `user` table carries
`library_id` + `role` directly (see `db/schema/auth.ts`), and onboarding assumes
a single tenant per account (domain-based). That `tenant_id`-on-`users` shape is
widely recognized as "the decision you cannot cheaply undo" — it encodes the
false assumption that a person belongs to exactly one organization. We now want:

1. **Self-signup.** Anyone registers with any email (work or personal). After
   signup they belong to **no** library yet.
2. **Create or join.** A signed-in user can **create** a new library (becoming
   its admin) or **join** an existing one.
3. **Discover + request to join public libraries.** Libraries have a
   **visibility** (public/private). Public ones are discoverable and a user can
   request to join via (a) a "Request to join" button, or (b) an **invite link**
   (optionally scanned). Requests await **admin approval**.
4. **Custom join forms.** Each library can define **required fields** an
   applicant must fill (e.g. employee ID, company email) before a request can be
   submitted; a company-email field can require **email verification**. Missing
   required fields block submission.
5. **Multiple libraries per user**, with an **active library** switch in the
   top-left so the same person can belong to several libraries (admin in one,
   reader in another).

Industry consensus (CIAM / B2B-SaaS modeling) strongly supports this: keep
**User = identity** separate from **Membership = relationship to an org**, model
membership as a junction with a **lifecycle** and an org-scoped **role**, and
treat the **invitation/request flow as part of the data model**.

## Decision

### 1. Split identity from membership

Introduce a **`membership`** table (user × library). The per-user `library_id` /
`role` on `user` are **retired as the source of truth**; a user's role is now
per-library (on the membership). `user` keeps a nullable **`active_library_id`**
= the currently selected library (drives the top-left switcher and all
tenant-scoped requests).

```
membership
  id            text pk
  user_id       text  → user.id
  library_id    text  → libraries.id
  role          text  ['library_admin','library_reader']   -- org-scoped
  status        text  ['active','suspended','removed']
  join_fields   json  -- snapshot of the custom join-form answers at approval
  created_at / updated_at
  unique(user_id, library_id)

user.active_library_id  text (nullable) → libraries.id
```

`super_admin` stays a **platform-scoped** role on `user` (NOT a membership) —
the platform operator is not "a member of a library". All other roles are
membership-scoped.

### 2. Membership + request lifecycle

A **join request** is distinct from an active membership (an invited/requested
person must not get permissions until active):

```
join_request
  id            text pk
  user_id       text → user.id
  library_id    text → libraries.id
  via           text ['button','invite']      -- how it originated
  invite_id     text (nullable) → invite.id
  answers       json  -- the custom-field answers submitted
  status        text ['pending','approved','rejected','cancelled']
  decided_by    text (nullable) → user.id      -- admin who approved/rejected
  created_at / decided_at
  unique(user_id, library_id) where status='pending'  -- one open request
```

Lifecycle:

```
request submitted ─approve─▶ membership(active)        (join_request→approved)
        │                                              + audit membership.join
        └─reject────────────▶ (join_request→rejected)
        └─cancel (by user)──▶ (join_request→cancelled)

membership: active ⇄ suspended ;  active/suspended ─remove─▶ removed (kept for audit)
```

Keeping `removed`/`rejected` rows (not deleting) preserves the audit trail
(consistent with ADR 0005).

### 3. Library visibility + discovery

Add `libraries.visibility ['public','private']` (default `private`). Public
libraries appear in a **discover** list; private ones are reachable only via an
invite link. Existing `emailDomains` is **demoted** from "auto-assign tenant" to
an optional **join hint / allowed-domain gate** a library may enforce on its
join form (e.g. "company email must end with @acme.com").

### 4. Invite links

```
invite
  id            text pk
  library_id    text → libraries.id
  token         text unique            -- random, URL-safe; the link secret
  role          text (default 'library_reader')
  requires_approval  boolean (default true)   -- false = join immediately
  max_uses      integer (nullable)
  used_count    integer default 0
  expires_at    integer (nullable)
  revoked       boolean default false
  created_by    text → user.id
  created_at
```

Invite URL: `/(t)/<slug>/join?invite=<token>` (QR-encodable). Security: tokens
are random + server-validated, support **expiry**, **max uses**, and
**revocation**; a revoked/expired/over-used token is refused. `requires_approval`
lets a library choose "invite = auto-join" vs "invite still needs approval".

### 5. Custom join forms

Each library defines the fields an applicant must provide:

```
join_field  (per library; ordered)
  id          text pk
  library_id  text → libraries.id
  key         text   -- machine key e.g. 'employee_id'
  label       text
  type        text ['text','email','select']
  required    boolean default true
  verify_email boolean default false   -- type=email: must verify ownership
  options     json (nullable)          -- for select
  position    integer
```

- The join form is rendered from this schema. **Client + server both validate**
  that all `required` fields are present → a request with missing required
  fields is rejected (cannot submit).
- A field with `verify_email` sends a verification code to the entered address;
  the request can't be submitted until that email is confirmed (reusing Better
  Auth verification primitives). This is how a library "verifies the company
  email".
- On approval, the submitted `answers` are snapshotted onto
  `membership.join_fields` so later edits to the library's form don't rewrite
  history.

### 6. Active-library switching + tenant isolation

- The top-left switcher sets `user.active_library_id`. Every tenant-scoped
  request resolves the tenant from `active_library_id` **and** verifies the user
  has an `active` membership in it (409/403 otherwise). This preserves the
  non-negotiable isolation rule under multi-membership: a user can only act in a
  library where they hold an active membership; `super_admin` bypasses via the
  platform scope.
- `tenantProcedure`/`adminProcedure` (apps/api/lib/trpc.ts) change from "read
  `user.libraryId`" to "resolve active membership for `active_library_id`", with
  `adminProcedure` requiring that membership's role ∈ {library_admin} (or
  super_admin platform-scope).

### 7. Post-signup empty state

A freshly-registered user with no memberships lands on a **"Create or join a
library"** screen (not `/books`). Personal-email users may stay membership-less
indefinitely (they simply see discover/create). Creating a library makes them
its `library_admin` (an initial `active` membership).

## Consequences

- **Data model**: +3 tables (`membership`, `join_request`, `invite`,
  `join_field`), + `user.active_library_id`, + `libraries.visibility`. `user`'s
  `library_id`/`role` become legacy (kept one release for rollback, then
  dropped).
- **Migration**: for each existing `user` with a `library_id`, create
  `membership(user_id, library_id, role, status='active')` and set
  `active_library_id = library_id`. Idempotent backfill script + Drizzle
  migration. Impersonation (ADR 0004) keeps working: impersonation targets a
  reader membership; the impersonated session's active library is that reader's.
- **Reconciliation with ADR 0006 (user vs reader)**: the "reader roster entry
  vs login account" distinction is subsumed — a roster member who "enables
  login" becomes a `membership(role=library_reader)`. ADR 0006's provision-on-
  demand path still applies when an admin adds someone.
- **Auth**: Better Auth session user no longer implies a tenant; the app derives
  tenant from `active_library_id` on each request. `emailDomains` stops being an
  auto-assignment and becomes an optional join-form gate.
- **Security surface added**: invite tokens (expiry/revoke/max-use), approval
  authorization (only admins of that library), email-ownership verification,
  and strict active-membership checks on every tenant request.
- **UX added**: discover list, request-to-join + invite-link join, per-library
  join-form builder (admin) + renderer (applicant), pending-requests approval
  queue (admin), active-library switcher.

## Non-goals (this phase)

- Fully custom per-library RBAC/permission sets — roles stay the fixed
  {library_admin, library_reader} set (+ platform super_admin).
- Org-to-org hierarchies / nested libraries.
- Billing/subscriptions per library.
- SSO/OAuth providers (Phase 2, ADR 0001). Email/password only.
- WeChat scan specifics (Phase 2); invite links are plain URLs/QR for now.

## Implementation order (incremental, test-pyramid per AGENTS.md)

1. Schema + migration + backfill (`membership`, `active_library_id`,
   `visibility`, `invite`, `join_request`, `join_field`) — unit-tested services.
2. Tenant resolution switch to active membership (`tenantProcedure`/
   `adminProcedure`) — integration tests for isolation.
3. Create-library + post-signup empty state + active-library switcher.
4. Discover public libraries + request-to-join (button) + approval queue.
5. Custom join-form builder/renderer + required-field + email verification.
6. Invite links (create/revoke/expiry/max-use) + join-via-invite.

## References

- CIAM Compass — "The Decision You Cannot Cheaply Undo" (tenant_id on users).
- Oladele David — "How to Model Teams Inside a Multi-Tenant Product"
  (membership ≠ user; PENDING/ACTIVE/SUSPENDED/REMOVED lifecycle; invitation in
  the data model).
- Multi-tenant RBAC schema patterns (junction tables; org vs platform scope).
- Supersedes/extends ADR 0006 (user vs reader); complements ADR 0003 (tenant
  subdomains), 0004 (impersonation), 0005 (audit log).
