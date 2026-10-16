# ADR 0002: Re-platform onto the React Starter Kit architecture (Bun monorepo + Hono/tRPC + Better Auth), keeping Cloudflare D1

- Status: Accepted
- Date: 2026-10-17
- Supersedes: much of ADR 0001 (stack/architecture). The product scope, multi-tenant
  rules, and Cloudflare hosting decision from 0001 still hold.

## Context

OpenBookCorner was built as a single TanStack **Start** app (SSR+SPA) using TanStack Start
**server functions** (no tRPC/Hono) and a Lucia-style email/password auth, on Cloudflare D1.

We decided to adopt the architecture of [kriasoft/react-starter-kit](https://github.com/kriasoft/react-starter-kit):
a production-grade, type-safe **Bun monorepo** with a clear web/app/api split, **Hono + tRPC**,
**Better Auth**, **TanStack Router SPA**, Tailwind v4 + shadcn/ui, and Drizzle ORM.

The starter kit defaults to **Neon PostgreSQL + Hyperdrive**. We explicitly **keep Cloudflare D1**
(SQLite): it is cheaper, simpler, edge-native (no connection pooler), and sufficient for this
domain. Neon/Hyperdrive/Terraform were the kit's choice for full Postgres + Stripe/organizations,
which Phase 1 does not need.

## Decision

Re-platform onto the kit's conventions, adapted to D1:

| Concern | Before (ADR 0001) | After (ADR 0002) |
| --- | --- | --- |
| Repo | single app | **Bun monorepo** (`apps/app`, `apps/api`, `db`, `packages/*`) |
| Package manager | pnpm | **Bun** |
| App shape | TanStack Start (SSR+SPA) | **TanStack Router SPA** (`apps/app`) + separate API worker |
| Server layer | server functions | **Hono + tRPC** (`apps/api`) |
| Auth | Lucia-style email/password | **Better Auth** (email/password), Drizzle adapter `provider: 'sqlite'` |
| DB | Drizzle + D1 | **unchanged — Drizzle + Cloudflare D1** |
| Deploy | one Worker | **two Workers**: `openbookcorner` (SPA assets + `/api/*` → service binding) and `openbookcorner-api` (Hono/tRPC/Better Auth, D1 binding) |

Dropped from the kit for Phase 1: Neon/Hyperdrive, Terraform (`infra/`), PGlite tests (we use an
in-memory sql.js SQLite test DB), Stripe billing, organizations, passkeys, email OTP, Google OAuth,
the Astro marketing site, and the React Email app. These can be reintroduced later.

## Consequences

- Multi-tenant isolation is enforced in tRPC middleware (`tenantProcedure`/`adminProcedure`), which
  attach a guaranteed `libraryId` + `role` from the Better Auth session user (extended with those
  fields via `additionalFields`).
- The SPA calls same-origin `/api/*`; the app worker forwards it to the API worker over a service
  binding, so the API worker needs no public route.
- Toolchain versions are pinned conservatively (TypeScript 5.9, Vite 6, Vitest 2) rather than the
  kit's bleeding edge (TS 7 / Vite 8) for migration stability.
- Phase 2 (WeChat/China) remains deferred, as in ADR 0001.
