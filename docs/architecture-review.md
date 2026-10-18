# OpenBookCorner — Architecture & Clean-Code Review

**Date:** 2026-10-18
**Scope:** Full repository, high-level architecture down to code-level, assessed against Clean Architecture and Clean Code principles.
**Reviewed revision:** `main` @ `8ee2936`

---

## 1. Executive summary

OpenBookCorner is a multi-tenant library-management PWA built as a Bun monorepo: a React 19 SPA (`apps/app`), a Hono + tRPC Cloudflare Worker (`apps/api`), and a shared Drizzle schema package (`db`). The code is in good shape. The layering is clean and one-directional, the client/server boundary is type-safe and enforced over HTTP, and — most importantly for a multi-tenant SaaS — tenant isolation is centralized correctly and no router bypasses it.

The main gap is **not** correctness; it is the **divergence between the DDD-heavy design docs and the pragmatic transaction-script implementation**, plus a handful of consistency smells (error surfacing, dual service styles, a 645-line service file, and a test harness that duplicates schema DDL by hand).

**Overall grade: B+ / strong.** Ship-ready architecture with a short list of maintainability improvements worth scheduling.

| Dimension | Rating | Notes |
|---|---|---|
| Layering / dependency direction | A | Clean one-way deps; frontend imports only the `AppRouter` type |
| Multi-tenant isolation | A | Centralized in the tRPC procedure ladder; grep-verified no bypass |
| Separation of concerns | B+ | Business logic lives in services; minor leak in `book.add` |
| Type safety | B+ | Strict TS; a few contained `as unknown as` casts for D1 `.batch()` |
| Error handling | B- | Services throw bare `Error('CODE')`; inconsistent translation to `TRPCError` |
| Domain modeling | C+ | Anemic vs. the documented DDD aggregates/value-objects/events |
| Code organization | B | Monolithic `services/index.ts`; dual class/function styles |
| Testability | A- | DI of `db` into services + sql.js harness is excellent |
| Docs ↔ implementation fidelity | C | Steering `design.md` describes a system that was not built |

---

## 2. Architecture overview

```
apps/app  (React 19 SPA)                     ← TanStack Router + Query + tRPC client
    │  depends ONLY on `AppRouter` type + HTTP (/api/trpc, /api/auth)
    ▼
apps/api  (Hono + tRPC Worker, @obc/api)     ← routers → services → Drizzle
    │  imports @obc/db
    ▼
db        (@obc/db)                          ← Drizzle schema + types + sql.js test harness
```

Dependency direction is strictly inward/one-way, which is the single most important Clean Architecture property, and it holds here:

- `db` depends on nothing internal.
- `apps/api` imports `@obc/db`.
- `apps/app` imports the **type** `AppRouter` from `@obc/api` for end-to-end inference (`apps/app/lib/trpc.ts:1`) and otherwise talks to the API only over HTTP. There is **no** runtime import of API/db internals into the SPA — the client/server boundary is respected.

### Request flow (API)

1. `apps/api/worker.ts:21-41` — per-request middleware validates env via Zod (`envSchema`), builds the Drizzle client (`createDb`), builds Better Auth (`createAuth`), and stashes both on Hono vars.
2. `apps/api/lib/app.ts:15-23` — composes the tRPC `appRouter` from seven sub-routers; registers `/health`, `GET /covers/:key` (R2 passthrough), the Better Auth catch-all, and the tRPC fetch adapter.
3. `apps/api/lib/app.ts:54-66` — tRPC `createContext` resolves the session (`auth.api.getSession`) and returns `{ req, resHeaders, env, db, session, user }`.

> **Note:** steering docs reference `packages/*`, but no `packages/` directory exists. The real workspaces are `apps/api`, `apps/app`, `db` (plus `e2e/`, `docs/`). Worth reconciling the docs.

---

## 3. What's done well

### 3.1 Multi-tenant isolation is centralized and correct
`apps/api/lib/trpc.ts` defines a clean procedure ladder:

- `publicProcedure` → `protectedProcedure` (requires session, narrows `ctx.user`/`ctx.session` to non-null, `trpc.ts:25-30`)
- `tenantProcedure` (`trpc.ts:36-42`) derives `libraryId` **from the authenticated user record, never from client input**, throws `FORBIDDEN/NO_LIBRARY_ACCESS` if absent, and enriches `ctx` with a **non-optional `libraryId` + `role`**.
- `adminProcedure` (`trpc.ts:45-50`) requires `library_admin|super_admin`.
- `superAdminProcedure` (`trpc.ts:58-63`) builds on `protectedProcedure` only — intentionally cross-tenant — with a prominent warning comment never to use it on tenant data paths.

The enforcement point is exactly right: `libraryId` is a server-derived, non-optional context field that every tenant service call consumes. A grep for raw `ctx.db.(select|insert|update|delete)` in routers returns **zero matches** — no router performs unscoped DB access.

### 3.2 Business logic lives in the service layer
Routers are thin: validate with Zod, delegate to a service. The real domain rules live in `apps/api/services/index.ts`. `CirculationService.borrow` is a highlight — it enforces overdue and borrow-limit rules, then **atomically claims a copy** with a guarded `UPDATE ... WHERE availableCount > 0 ... RETURNING` to defeat the read-modify-write race, and `returnBook` uses a guarded active→returned transition with a `MIN(...)` cap so a concurrent return cannot credit inventory twice. This is careful, correct concurrency handling on D1.

### 3.3 Anti-corruption layer for external metadata
`openLibrary.ts`, `googleBooks.ts`, and `bookMetadata.ts` isolate third-party response shapes behind a stable internal interface — textbook ACL. `covers.ts` content-addresses cover images into R2 and the app serves them same-origin with immutable caching (`app.ts:31-41`).

### 3.4 Dependency injection makes services testable
Every service takes `private db: Database` in its constructor and is instantiated per-call (`new BookService(ctx.db)`). Combined with the in-memory sql.js harness (`db/testing.ts`), this yields fast, isolated unit tests without a real D1.

### 3.5 Security details that show care
- Tenant fields `libraryId`/`role` are Better Auth `additionalFields` with `input: false` (`auth.ts:46-55`) — the client cannot set them.
- Trusted origins are environment-aware and deliberately **do not** trust `*.workers.dev` (`auth.ts:21-32`), with the reasoning documented inline.
- Client-side role checks in `_app/route.tsx` are UX-only; authorization is enforced server-side in the procedure ladder — no trust-boundary violation.

---

## 4. Findings & recommendations

Ordered by impact. Severity: 🔴 high · 🟡 medium · 🟢 low/nit.
Status: ✅ fixed in this PR · ⏭️ follow-up.

### 🟡 F1 — Design docs describe a DDD system that was not built ⏭️
`.kiro/steering/design.md` specifies rich aggregates (`Library`, `Book`, `BorrowTransaction` with behavior), value objects (`ISBN`, `BookInventory`), domain events, repository interfaces, and a Result pattern. **None of this exists.** The implementation is transaction-script / table-module: Drizzle row types (`Book = typeof books.$inferSelect`) flow around as plain data and services issue SQL directly.

This is a reasonable pragmatic choice for the current scale — but the docs are now misleading for anyone onboarding. **Recommendation:** either (a) demote the DDD content in `design.md` to an explicit "aspirational / future" section and document the actual transaction-script approach as the current reality, or (b) commit to extracting the highest-value domain invariants (borrowing rules, inventory accounting) into a thin domain module. Prefer (a) now; revisit (b) if the circulation rules keep growing.

### 🟡 F2 — Inconsistent error handling across the transport boundary ✅ fixed
Services signal failure with bare string-coded errors, e.g. `throw new Error('BOOK_NOT_AVAILABLE')` / `'BOOK_CURRENTLY_BORROWED'` (`services/index.ts`). Routers translate these inconsistently:

- `book.update` maps a not-found result to a typed `TRPCError({ code: 'NOT_FOUND' })` (`routers/book.ts:81-84`).
- `book.remove` lets the service's string `Error` propagate untranslated (`routers/book.ts`).

So two mutations on the same router surface failures differently (one as a structured tRPC error with a code, one as a generic 500-ish internal error).

**Resolution:** Added a typed `DomainError` (stable `code`) plus `toTRPCError` / `mapDomainErrors` helpers in `apps/api/lib/errors.ts`. Services now throw `DomainError('CODE')`; `book.update`/`book.remove` and the circulation router (`borrow`, `borrowByIsbn`, `return`) all route through `mapDomainErrors`, so every domain failure surfaces as a `TRPCError` with a mapped code (`NOT_FOUND` / `CONFLICT` / `BAD_REQUEST`). The code string is preserved as the error message, so the SPA's substring matching in `apps/app/lib/errors.ts` keeps working unchanged.

### 🟡 F3 — Business orchestration leaking into a router ✅ fixed
`book.add` performed the R2 cover-persist side effect inline before delegating to the service (`routers/book.ts:52-63`): it called `storeCoverImage`, rewrote `coverImageUrl`, then called `BookService.add`. Transport code should not orchestrate storage.

**Resolution:** `BookService.add` now accepts an optional `covers?: R2Bucket` and performs the cover-persist step internally. The router just validates and delegates (`new BookService(ctx.db).add({ ...input, libraryId, covers: ctx.env.COVERS })`).

### 🟡 F4 — `services/index.ts` is a 645-line module holding six services ⏭️
`BookService`, `CirculationService`, `LibraryService`, `FeedbackService`, `TenantAdminService`, `MemberService` all live in one file. This hurts navigability and cohesion. **Recommendation:** split into `services/book.ts`, `services/circulation.ts`, etc., and keep `services/index.ts` as a barrel re-export. (The free-function services like `covers.ts`/`openLibrary.ts` are already separate — align the classes with that.)

### 🟡 F5 — Test harness duplicates schema DDL by hand (drift risk) ⏭️
`db/testing.ts:18-78` hand-writes `CREATE TABLE` DDL mirroring `db/schema/domain.ts` rather than deriving from Drizzle migrations. Any schema change must be manually mirrored here, and the sql.js tables carry none of the `references()` FK constraints. **Recommendation:** generate the test DDL from the Drizzle schema (or apply the migration files to the in-memory DB) so the harness can never silently drift from production schema.

### 🟢 F6 — Contained type-safety casts for D1 `.batch()` ⏭️
`insertChunked` casts to call D1's `.batch()` (`services/fanshuImport.ts:109-110`), and the same shim is re-created in `db/testing.ts:80-85`; `createDb` also casts (`lib/db.ts:6`). These are documented and contained (not leaking into domain types), but they're the one place `any`-style escapes live outside tests. **Recommendation:** wrap D1 `.batch()` behind one typed helper in `@obc/db` and have both the worker and the test harness use it, removing the duplicated casts.

### 🟢 F7 — Schema timestamp inconsistency ⏭️
Auth tables use `integer timestamp` (`schema/auth.ts`), domain tables use `text` columns defaulting to the literal string `'CURRENT_TIMESTAMP'` with ISO strings set manually in services (`schema/domain.ts`). Mixed representations complicate cross-table reasoning and querying. **Recommendation:** pick one timestamp representation for domain tables (ISO text is fine) and ensure the default is applied by the DB or always by a shared helper, not ad hoc per service.

### 🟢 F8 — Minor pagination default inconsistency ✅ fixed
`BookService.listByLibrary` defaulted `limit` to 20 while `MemberService.listByLibrary` defaulted to 50 (both cap at 200).

**Resolution:** Introduced shared `DEFAULT_PAGE_SIZE` (20) and `MAX_PAGE_SIZE` (200) constants in `services/index.ts`; both listings now use them.

### 🟢 F9 — Silent error swallowing in cover storage ✅ fixed
`storeCoverImage` swallowed all failures to `null` by design (`covers.ts`). Acceptable for a non-critical path, but invisible in production.

**Resolution:** The `catch` now emits a structured `console.warn('storeCoverImage failed', { sourceUrl, isbn, error })` before returning `null`, so cover-storage regressions are observable without blocking the add.

### 🟢 F10 — Docs reference non-existent `packages/*` ⏭️
See §2 note. Reconcile `AGENTS.md` / steering with the real workspace layout.

---

## 5. Suggested sequencing

1. **Quick wins (low risk):** ✅ F2 (shared error→TRPCError helper), ✅ F3 (move cover persist into service), ✅ F8/F9 (defaults, logging); ⏭️ F10 (doc fix).
2. **Maintainability (medium):** ⏭️ F4 (split `services/index.ts`), F6 (single typed `.batch()` helper), F5 (generate test DDL from schema).
3. **Strategic (discuss first):** ⏭️ F1 (reconcile DDD docs vs. transaction-script reality), F7 (timestamp normalization — needs a migration).

F2, F3, F8, and F9 are implemented in this PR (all 76 API/db tests pass; the touched files typecheck and lint clean). The remaining items are documented follow-ups — F4/F5/F6/F7 are mechanical but larger, and F1 is a decision rather than a code change.

---

## 6. File reference index

| Concern | File:line |
|---|---|
| Tenant procedure ladder (isolation core) | `apps/api/lib/trpc.ts:20-63` |
| tRPC context assembly | `apps/api/lib/app.ts:50-73` |
| Worker bootstrap (db/auth/env per request) | `apps/api/worker.ts:21-50` |
| Better Auth config + tenant fields | `apps/api/lib/auth.ts:21-55` |
| Core services (6 in one file) | `apps/api/services/index.ts` |
| Circulation concurrency handling | `apps/api/services/index.ts` (`CirculationService.borrow` / `returnBook`) |
| Cover persist leak in router | `apps/api/routers/book.ts:52-63` |
| `.batch()` casts | `apps/api/services/fanshuImport.ts:109-110`, `db/testing.ts:80-85` |
| Domain schema (tenant tables) | `db/schema/domain.ts` |
| Test harness (hand-written DDL) | `db/testing.ts:18-85` |
| Frontend client/server boundary | `apps/app/lib/trpc.ts` |
| Auth gate (route guard) | `apps/app/routes/_app/route.tsx:14-24` |
