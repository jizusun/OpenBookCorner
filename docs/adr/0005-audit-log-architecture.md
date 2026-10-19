# 0005 — Audit log architecture (layered visibility, coverage, super-admin global view)

- Status: Accepted
- Date: 2026-10-20
- Deepens: ADR 0004 Part A (privileged-action audit log). 0004 introduced the
  append-only `audit_logs` table + `AuditService`; this ADR fixes the
  *architecture* around it: what we record, who can read what, and how the
  super admin sees "everything" without breaking tenant isolation.

## Context

`audit_logs` is append-only (`id, actorUserId, onBehalfOfUserId, libraryId,
action, targetType, targetId, metadata, createdAt`) and `AuditService` only
exposes `log()` + scoped reads — no update/delete. That matches the industry
definition of an audit trail: an **immutable, append-only record of who did
what, when, where, and the result**, used for security/compliance/forensics
(not operational debug logs).

Two gaps surfaced in review:

1. **Coverage**: writes covered `tenant.*`, `book.*`, `library.updateSettings`,
   `impersonation.*`, and onboarding (`tenant.addAdmin` / `member.create`), but
   **not borrow/return** — the highest-frequency state change in the product.
   An audit trail is expected to record all security-/business-relevant
   CREATE/UPDATE/DELETE actions; circulation was a real hole.

2. **Visibility**: the only audit UI (`/admin/audit`) showed `listSystem()`
   (rows where `library_id IS NULL`) — tenant-scoped changes (book/settings/
   members/circulation) never appeared, so the page looked sparse and did not
   feel like "the log of everything that changed".

## Decision

### 1. Record all security-/business-relevant changes

Every privileged CREATE/UPDATE/DELETE writes an audit row server-side (so a
direct API call can't skip it). This now includes **`circulation.borrow` /
`circulation.return`** (tenant-scoped; actor = the borrowing user, target = the
book). Reads are not audited (noise, not security-relevant here).

### 2. Layered, permission-isolated reads (NOT one list for everyone)

Multi-tenant audit best practice (and SOC2-style guidance) is a single
`audit_logs` table with a `libraryId` column, read through **separate,
permission-scoped paths** — never a shared query that can forget to filter:

- **Library admin → their tenant only**: `listByLibrary(libraryId)` /
  `listByLibraryAction` (always force the `libraryId` filter). This is the
  per-library "activity" view.
- **Super admin → system-level**: `listSystem()` (rows with `library_id IS
  NULL`: cross-tenant ops like `tenant.create` + `impersonation.*`).
- **Super admin → global, cross-tenant**: `listAll({ page, limit, libraryId?,
  action? })` — an **explicit, super-admin-only** reader that spans all tenants,
  **paginated and filterable by tenant/action**. This is legitimate for the
  platform operator (compliance/forensics) and is the backing for the
  super-admin audit page showing "everything that changed", with filters.

The documented multi-tenant pitfall is an *accidental cross-tenant query* (a
read path that forgets the tenant filter). Mitigation: tenant-scoped readers
always bind `libraryId`; the only unscoped reader (`listAll`) is explicitly
super-admin-guarded and exists for the platform operator by design.

### 3. Immutability

`audit_logs` is append-only: `AuditService` exposes no update/delete; rows are
never mutated. (Cryptographic tamper-evidence / external WORM storage is a
future hardening, not required for Phase 1.)

### 4. Scale

The global reader is **paginated** (default page size bounded) and filterable
(tenant/action), because circulation makes the table high-volume. The UI never
pulls the full table.

## Consequences

- `/admin/audit` (super admin) is backed by `listAll` → shows **all tenants'
  changes**, filterable by tenant + action, paginated — the "log of everything".
- `listSystem` remains available for the system-only slice; a future per-tenant
  "activity" page for library admins uses `listByLibrary` (backend ready).
- Borrow/return now appear in the trail.
- Tenant isolation is preserved: only the explicitly super-admin-guarded
  `listAll` crosses tenants; everything else is `libraryId`-bound.

## References (industry practice consulted)

- Append-only / immutable "who/what/when/where/result" is the common audit-log
  definition (devsecopsnow, contentful, loginradius, oneuptime — SOC2/HIPAA/GDPR).
- Multi-tenant single-table + `tenant_id`, with the "accidental cross-tenant
  query" as the top pitfall, and layered tenant-admin vs platform-operator
  visibility (dev.to "Multi-Tenant Audit Logging: The Architecture Mistakes We
  Made"; umatechnology multi-tenant audit series).
- Record CREATE/UPDATE/DELETE of security-/business-relevant actions; reads
  usually excluded.
