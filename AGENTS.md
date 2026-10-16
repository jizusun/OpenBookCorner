# AGENTS.md — OpenBookCorner

Instructions for AI coding agents working in this repository. Read this before writing code.

## Project

OpenBookCorner is a **multi-tenant library-management PWA**. See
`docs/adr/0002-react-starter-kit-migration.md` for the current architecture (it supersedes the
stack parts of `docs/adr/0001-tech-stack-and-hosting.md`). `.kiro/steering/` holds product/design docs.

## Stack (ADR 0002 — React Starter Kit architecture on Cloudflare D1)

Bun monorepo (workspaces: `apps/*`, `db`, `packages/*`):

- `apps/app` — **React 19 SPA**: **TanStack Router** (file-based) + **TanStack Query** + **tRPC client**
  (`@trpc/tanstack-react-query`) + **Tailwind v4** + **shadcn/ui**. Deployed as the public Worker
  (`openbookcorner`): serves built static assets and forwards `/api/*` to the API worker over a
  **service binding**.
- `apps/api` — **Hono + tRPC** Worker (`openbookcorner-api`): routers `auth/book/borrowing/library/feedback`
  with `tenantProcedure`/`adminProcedure` middleware. **Better Auth** (email/password) at `/api/auth/*`.
- `db` (`@obc/db`) — **Drizzle ORM** schema for **Cloudflare D1** (SQLite): Better Auth tables
  (`user/session/account/verification`, `user` extended with `libraryId`+`role`) + domain tables
  (`libraries/books/borrowTransactions/feedback`). In-memory **sql.js** test DB in `db/testing.ts`.
- Toolchain: **Bun 1.4.3**, TypeScript 5.9, Vite 6, Vitest 2, oxlint. Build order:
  `db` → `apps/api` (composite, emits d.ts) → `apps/app`. Typecheck via `bun run typecheck` (`tsc --build`).

> We keep **Cloudflare D1** (not the kit's Neon/Hyperdrive). Dropped for Phase 1: Stripe, orgs,
> passkeys, email OTP, Google OAuth, Astro web, email app, Terraform. WeChat/China is Phase 2.

## Non-negotiable rules

1. **Multi-tenant isolation**: EVERY database query MUST be scoped by `libraryId`. Never allow
   cross-tenant reads/writes. Use `tenantProcedure`/`adminProcedure` in `apps/api/lib/trpc.ts`.
2. **Type safety**: strict TypeScript, no `any`. Validate all tRPC inputs with Zod (`.input(zodSchema)`).
   NOTE: `apps/app/lib/trpc.ts` exports need explicit type annotations (`TRPCClient<AppRouter>` /
   `TRPCOptionsProxy<AppRouter>`) to avoid TS2742.
3. **tRPC procedures**: pick the right base — `publicProcedure`, `tenantProcedure` (members),
   `adminProcedure` (library_admin/super_admin) — then act.
4. **Testing**: Vitest. API/db tests run from the root config (`bun run test`); app component tests
   via `bun --cwd apps/app test` (happy-dom/jsdom). Use `@testing-library/react`.
5. **Verify before done**: `bun run typecheck` + tests + `bun --cwd apps/app build` after changes.
   Clean up temp files.

## Deploy

- API: `cd apps/api && wrangler deploy` (D1 binding `DB` → database `openbookcorner`).
- App: `cd apps/app && vite build && wrangler deploy` (serves `dist/`, service binding `API`).
- D1 migrations: generate with `bun --cwd db generate`; apply with
  `wrangler d1 migrations apply openbookcorner --remote` (from `apps/api`, migrations dir `../../db/migrations`).
- Secret: `BETTER_AUTH_SECRET` on the API worker (`wrangler secret put`).
- Deploy env is WSL + Windows mihomo proxy: route Node fetch through `HTTPS_PROXY=http://127.0.0.1:7890`.
  `cf` CLI is authenticated via OAuth for token minting; wrangler used for D1 + deploy.


## Agent tooling available in this repo

This repo is wired for agent tooling via `.kiro/agents/openbookcorner.json`. Use it:

### Cloudflare MCP (`@cloudflare`)
Remote MCP at `https://mcp.cloudflare.com/mcp`. Use it for: Cloudflare developer docs, Workers/D1/KV/R2
API operations, Wrangler config questions, and deploy workflows. Prefer this over guessing Cloudflare APIs.
(First use may require an OAuth browser flow via `/mcp`.)

### shadcn MCP (`@shadcn`)
Local stdio server (`npx shadcn@latest mcp`). Use it to browse/search/install UI components from the
shadcn registry with natural language instead of hand-writing component boilerplate. Requires a
`components.json` in the project (created during scaffolding).

### TanStack Intent (versioned Agent Skills)
TanStack ships **version-matched `SKILL.md` skills inside its npm packages**. This keeps the agent on
*current* TanStack Start / Router / Query APIs (no stale rules files). After the project is scaffolded
and TanStack deps are installed:

```bash
# one-time, from the project root (writes guidance into this AGENTS.md):
npx @tanstack/intent@latest install

# discover available skills from installed deps:
npx @tanstack/intent@latest list

# load a specific skill on demand before writing that code, e.g.:
npx @tanstack/intent@latest load @tanstack/query#fetching
npx @tanstack/intent@latest load @tanstack/react-router#routing
```

Always `load` the relevant TanStack skill before writing TanStack-heavy code, so you use the API that
matches the installed version.

### Cloudflare CLI / Agent Setup
Besides the remote MCP, Cloudflare offers an **Agent Setup** flow (https://developers.cloudflare.com/agent-setup/)
to connect coding agents and build/deploy from the terminal.

**Use the `cf` CLI whenever possible.** This project is migrated to the Cloudflare CLI
(`cloudflare.config.ts`), so prefer `cf` for account/API/deploy work:

- Deploy: `pnpm exec cf deploy` (builds via Vite + deploys the Worker; uses `cloudflare.config.ts`).
- Account/API ops: `pnpm exec cf accounts tokens ...`, `cf d1 ... --remote`, `cf zones ...`, etc.
- Preview deployments: `cf deploy` uploads a **version** and (with `previewUrls: true`, which is set
  on the worker) each version gets its own **per-version preview URL** — use `cf previews` to manage
  them. This lets you share/test a build without touching the production custom domain.
- Auth: `cf auth login` (device flow). The `cf` shim may be intercepted by mise; call it via
  `pnpm exec cf` to use the project-local binary. Never paste tokens into chat.

**Wrangler is the single exception — local development only.** `cf dev` does not support `--local`
yet (Miniflare v5 is preparing cf local dev), and *"you can only populate local resources with data
via the Wrangler CLI"* (Cloudflare docs). So the E2E server + local D1 seeding use
`wrangler dev --local` / `wrangler d1 ... --local`. Everything else should go through `cf`.

### llms.txt docs
- Drizzle: via its `llms.txt`
- Hono: https://hono.dev/llms-full.txt (only relevant if a standalone Hono API is added in Phase 2)
Fetch these when you need current Drizzle (or, in Phase 2, Hono) guidance.

## Workflow expectations

- Follow the feature order in `.kiro/steering/structure.md`: model/types → schema (tenant-scoped) →
  service (tenant validation) → server functions → UI → tests → docs.
- Keep changes scoped. Match existing conventions. Ask before destructive or production actions.

<!-- tanstack-intent:start -->
<!-- `npx @tanstack/intent@latest install` will manage guidance between these markers once deps are installed. -->
<!-- tanstack-intent:end -->
