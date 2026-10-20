# Development

Developer guide for OpenBookCorner. For what the product does see the
[README](../README.md); for architecture + how to deploy see
[`deployment.md`](./deployment.md).

## Tech stack

A **Bun monorepo** (workspaces: `apps/*`, `db`, `packages/*`) deployed to
Cloudflare.

- **`apps/app` — frontend**: React 19 SPA, **TanStack Router** (file-based) +
  **TanStack Query** + a typed **Hono RPC (`hc`) client**, **Tailwind v4**,
  **shadcn/ui**. Deployed as the public Worker `openbookcorner`: serves the built
  SPA and forwards `/api/*` to the API worker over a service binding.
- **`apps/api` — backend**: **Hono** on Cloudflare Workers (`openbookcorner-api`),
  composed sub-apps (`book/borrowing/library/member/feedback/tenant/admin`) with
  `sessionAuth` / `tenant` / `admin` / `superAdmin` middleware. **Better Auth**
  (email/password + the `admin` plugin for impersonation) under `/api/auth/*`.
- **`db` (`@obc/db`)** — **Drizzle ORM** schema for **Cloudflare D1** (SQLite):
  Better Auth tables (`user/session/account/verification`, `user` extended with
  `libraryId`+`role`) + domain tables (`libraries/books/members/
  borrowTransactions/feedback/auditLogs/importRuns/reviews/purchaseRequests`).
  In-memory **sql.js** test DB in `db/testing.ts`.
- **i18n**: Lingui (English + 简体中文), catalogs in `apps/app/lib/i18n/locales`.
- Toolchain: **Bun 1.4.x**, TypeScript 5.9 (strict), Vite 6, Vitest, Playwright,
  oxlint. Build order: `db` → `apps/api` (composite, emits d.ts) → `apps/app`.

## Core concepts

- **Multi-tenant isolation**: every domain query is scoped by `libraryId`;
  tenant-scoped API uses `tenantProcedure`/`adminProcedure`-style middleware.
  Tenants are addressed by path: `/t/:slug`.
- **User vs Reader** (see [ADR 0006](./adr/0006-user-vs-reader.md)): a **User** is
  a login account (role: super_admin / library_admin / library_reader); a
  **Reader** is a library roster entry (`members` table) that may have no account
  (e.g. 番薯 imports). The admin UI says "Users" and "Readers", never "Member".
- **Audit** (see [ADR 0005](./adr/0005-audit-log-architecture.md)): append-only
  `audit_logs`; layered reads — `listByLibrary` (tenant admins), `listSystem`
  and the paginated/filterable `listAll` (super admin).
- **Impersonation** (see [ADR 0004](./adr/0004-audit-impersonation.md)): Better
  Auth admin plugin; super-admin only, readers only (enforced in UI + a server
  `session.create.before` guard), time-boxed, audited, banner + exit.
- **Super-admin console**: Overview / Tenants (+detail) / Users / Books / Audit /
  System — see [`super-admin-console.md`](./super-admin-console.md).

## Repository layout

```
apps/app/            React SPA (routes/, components/, lib/)
  routes/_app/admin/ super-admin + library-admin pages
  components/ui/      shared UI (DataTable, SearchBar, Pager, modal, …)
apps/api/            Hono API (http/ sub-apps, services/, lib/ middleware+auth)
db/                  Drizzle schema, migrations/, testing.ts (sql.js)
docs/                this guide, deployment, ADRs, super-admin-console, TODO
```

Reusable building blocks worth knowing: `components/ui/DataTable` (the one quiet
table every admin list uses), `SearchBar`, `Pager`, `modal`
(`Modal`/`ConfirmDialog`), `AddUserDialog`.

## Setup

```bash
bun install
# optional: mise for tool versions (mise install)
```

## Everyday commands

```bash
bun run typecheck                 # tsc --build (composite) — run after any change
bun run test                      # API + db unit/integration (root Vitest)
bun --cwd apps/app test           # component tests (jsdom)
bun --cwd apps/app run build      # build the SPA
cd e2e && bun run test            # Playwright E2E on one wrangler dev worker
```

Before E2E, wipe local state: `rm -rf apps/app/.wrangler/state
apps/api/.wrangler/state .wrangler/state`.

## TDD workflow (required)

For every change, present the test plan across the pyramid (unit ≫
integration/component ≫ E2E) before coding, push the majority to **unit**
(pure functions + services on the sql.js test DB), reserve integration/component
for wiring + guards and E2E for the few real end-to-end flows (auth cookie
round-trips). See `AGENTS.md` for the full rules.

## i18n

After adding/removing/moving any `<Trans>` or `` t`…` `` string:

```bash
bun --cwd apps/app i18n:extract -- --clean   # update .po (CI checks this exact diff)
```

Then add 简体中文 for new msgids (CI fails on untranslated). **Never pass
lingui's macro `t` into a plain helper** — it only transforms in-component and
yields an empty string at runtime; render labels with `<Trans>` in a small
in-component component instead.

## Testing layers

- **Unit**: pure logic + service classes against the sql.js test DB
  (`@obc/db/testing`: `createTestDb`, `seedLibrary`, `seedUser`, `seedBook`,
  `seedMember`).
- **Integration**: real composed Hono app via `apps/api/http/testHarness.ts`
  (stub auth supplies a session + `createUser`); exercises middleware guards +
  tenant scoping.
- **Component**: `@testing-library/react`; assert `data-testid`/structure, not
  translated copy (the app defaults to zh in component tests).
- **E2E**: Playwright against one `wrangler dev --local` worker; the only place
  the Better Auth cookie round-trip / impersonation session swap is real.

## ADRs

Architectural decisions live in [`docs/adr`](./adr). Write one proactively for
any non-trivial architectural/product decision (see `AGENTS.md`).
