# AGENTS.md — OpenBookCorner

Instructions for AI coding agents working in this repository. Read this before writing code.

## Project

OpenBookCorner is a **multi-tenant library-management PWA**. See `docs/adr/0001-tech-stack-and-hosting.md`
for the finalized stack decision and `.kiro/steering/` for product, design, structure, tech, and testing docs.

> Note: `.kiro/steering/*` and the Release 1 MVP spec have been updated to match ADR 0001
> (TanStack Start + server functions). ADR 0001 remains the source of truth if any conflict arises.

## Stack (ADR 0001)

- Frontend: **TanStack Start** (React, Vite) + **shadcn/ui** + Tailwind CSS
- Client data: **TanStack Query** (caching, optimistic UI, offline persistence)
- Server logic: **TanStack Start server functions** (`createServerFn`) — type-safe, no tRPC, no Hono
- ORM/DB: **Drizzle ORM** + **Cloudflare D1** (SQLite), **KV** (sessions/codes), **R2** (covers)
- Auth: **Lucia Auth**, email/password for Phase 1
- Hosting: **Cloudflare Workers** (Phase 1). WeChat/China migration is Phase 2 — see ADR 0001.

## Non-negotiable rules

1. **Multi-tenant isolation**: EVERY database query MUST be scoped by `libraryId`. Never allow
   cross-tenant reads/writes. Validate tenant access in every server function.
2. **Type safety**: strict TypeScript, no `any`. Use branded ID types (`UserId`, `BookId`, `LibraryId`).
   Validate all inputs with Zod (validate server-function inputs with `.validator(zodSchema)`).
3. **Server functions**: check auth + tenant first (reusable auth/tenant middleware or guard), then act.
4. **Testing (BDD + TDD)**: follow `.kiro/steering/testing.md`. Use Vitest + Playwright. For React
   component tests use `@testing-library/react` (the steering doc's `@testing-library/svelte` is superseded).
5. **Verify before done**: run build + relevant tests after changes. Clean up temp files.

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
to connect coding agents and build/deploy from the terminal, and **Wrangler** is the primary CLI for
Workers/D1/KV/R2 operations and deploys (`npx wrangler ...`). Use Wrangler for local dev, resource
creation, and deploys; authenticate with `npx wrangler login` (never paste tokens into chat).

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
