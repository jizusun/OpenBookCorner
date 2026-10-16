# ADR 0001: Technology Stack & Hosting Decision

- Status: Accepted
- Date: 2026-10-16
- Supersedes: the SvelteKit-based assumptions in `.kiro/steering/{tech,structure,design,testing}.md`
  (those steering docs should be updated to match this ADR in a follow-up)

## Context

OpenBookCorner is a multi-tenant library-management PWA. Two requirements shaped this decision:

1. **Phase 1 goal**: ship the core circulation loop (Release 1 MVP) as simply and cheaply as
   possible, on **Cloudflare**, with **simple email/password authentication**.
2. **Future requirement**: users are in **China** and will **scan a QR code with WeChat**;
   later we want **WeChat OAuth login** ("scan → WeChat-authorized identity → logged in"),
   and possibly a **WeChat Mini Program**.

The original steering docs assumed **SvelteKit + Cloudflare**. We re-evaluated the frontend
framework, UI library, and hosting against these requirements, with a strong emphasis on
**AI/agent-assisted development** (the stack must let coding agents use *current*, correct APIs).

## Decision

### Finalized stack (Phase 1)

| Layer | Choice |
|-------|--------|
| Frontend framework | **TanStack Start** (React, full-stack, Vite) |
| UI components | **shadcn/ui** + Tailwind CSS |
| Data layer (client) | **TanStack Query** (caching, optimistic UI, offline persistence) |
| API / server logic | **TanStack Start server functions** (`createServerFn`) — type-safe, no separate API layer |
| Backend runtime | **Cloudflare Workers** (TanStack Start deploys to Workers) |
| ORM | **Drizzle ORM** |
| Database | **Cloudflare D1** (SQLite) + **KV** (sessions/codes) + **R2** (covers) |
| Auth (Phase 1) | **Lucia Auth**, email/password (simplest) |
| Hosting (Phase 1) | **Cloudflare** (Workers + Pages/static assets) |

> **No tRPC and no Hono in Phase 1.** TanStack Start's server functions provide end-to-end type
> safety natively, so a separate RPC layer (tRPC) and a standalone HTTP framework (Hono) are
> unnecessary boilerplate for an all-in-one TanStack Start app. A decoupled API (e.g. Hono + tRPC,
> or Hono RPC) can be reintroduced in **Phase 2** if/when the backend must be split from the
> frontend for China hosting.

### Phased hosting / identity plan

- **Phase 1 — Cloudflare + email/password.** Validate the MVP on Cloudflare's free tier.
- **Phase 2 — WeChat integration.** Add WeChat OAuth web login. This introduces China-specific
  constraints that Cloudflare cannot satisfy on the interactive/auth path:
  - WeChat OAuth `redirect_uri` + JS-SDK secure domains must be **ICP-filed and whitelisted**;
    Cloudflare domains generally cannot be ICP-filed.
  - Cross-border latency from mainland China to Cloudflare is poor on the hot path.
  - ISBN barcode scanning inside the WeChat WebView needs **WeChat JS-SDK `wx.scanCode`**,
    not the raw web Camera API that the current spec (Release 2) assumes.
  - Likely relocation of the interactive layer + DB to an in-China, ICP-filed host
    (e.g. **Tencent CloudBase**: native WeChat sign-in, Postgres + RLS). Drizzle ports from
    D1 (SQLite) to Postgres, so the data layer survives.
  - Keep Cloudflare's free tier for **async/non-interactive** work (cron overdue checks,
    email, Open Library metadata lookups, static/cover assets).
  - Identity model change: link WeChat `openid`/`unionid` to users; solve tenant assignment
    via email-domain binding and/or tenant-scoped invite QR codes.
- **Phase 3 — optional WeChat Mini Program** (uni-app/Taro or CloudBase-backed) for first-class
  `wx.login` / `wx.scanCode`, if deeper WeChat-native UX is wanted.

## Rationale

### Why TanStack Start (React) over SvelteKit / Remix / Next.js

- **shadcn/ui is React-first** — choosing shadcn/ui as the UI library implies a React framework.
- **Cloudflare integration**: React Router v7 (Remix) is the deepest, TanStack Start is
  well-supported and Cloudflare-sponsored, Next.js is the weakest (OpenNext adapter, Vercel-first).
- **Offline + optimistic UI**: TanStack Query (native to TanStack Start) is best-in-class for
  Release 5 offline requirements and the Task 10 optimistic borrow/return flow.
- **Type safety**: TanStack Start has the strongest end-to-end typed routing/params, matching our
  no-`any`, branded-types mandate; its server functions give typed client↔server calls without tRPC.
- **Portability**: runs on any JS runtime (Vite/Nitro), easing the Phase 2 migration off Cloudflare.

Trade-offs accepted: TanStack Start is the **youngest** option; SSR + Workers + edge auth cookies
need care; and the SvelteKit specs/steering docs required rewriting for React (now completed).

### Why shadcn/ui

Best UI library for AI-assisted development: components are **copy-paste source you own**
(no dependency/version drift for agents), ships an **official MCP server** for browse/search/install,
and the component schema can be fed to agents to prevent hallucinated props. Multi-framework.

### Why TanStack Start server functions + Drizzle + D1 (no tRPC, no Hono)

TanStack Start's `createServerFn` provides type-safe server logic callable from the client with
full inference — covering what tRPC would give us, without the extra RPC layer or a standalone HTTP
framework (Hono). For an all-in-one TanStack Start app on Cloudflare, this is the simplest Phase 1
path: server functions call Drizzle services, which query D1 with mandatory `libraryId` scoping.
Drizzle stays portable to Postgres for the Phase 2 China migration.

**Why not tRPC/Hono now:** they add boilerplate and a network seam we don't need while the frontend
and server live in one TanStack Start app. The seam becomes useful only in **Phase 2**, if the API
must be split out and hosted in China separately from the frontend — at which point Hono + tRPC (or
Hono RPC) can be introduced for that boundary.

### AI / agent tooling (a first-class selection criterion)

The stack was chosen partly because each layer has strong, current agent tooling:

- **TanStack Intent** — official system that ships versioned **Agent Skills (`SKILL.md`)**
  *inside the npm packages* for TanStack Start/Router/Query. Skills stay version-matched to the
  installed code (no stale rules files). Open standard (Claude Code, Cursor, Copilot, Codex).
- **shadcn MCP server** — official; lets agents browse/search/install components from the registry.
- **Cloudflare MCP server** (`https://mcp.cloudflare.com/mcp`) — official; ~2,500 API endpoints
  plus developer docs; can build/deploy Workers.
- **llms.txt** — **Drizzle** is consumable via its `llms.txt`. (Hono's `llms.txt` only becomes
  relevant if a standalone Hono API is introduced in Phase 2.)

See `AGENTS.md` and `.kiro/agents/openbookcorner.json` for how these are wired into this repo.

## Consequences / Open items

- **Spec rewrite (done)**: `.kiro/steering/tech.md`, `structure.md`, `design.md`, `testing.md`,
  the Release 1 MVP spec, `README.md`, and `AGENTS.md` have been updated from SvelteKit → TanStack
  Start/React with server functions (incl. `@testing-library/react`).
- **Phase 2 gatekeepers to confirm early**: ICP filing + WeChat Official Account / Open Platform
  registration. Without ICP filing, WeChat web login cannot go to production.
- **Barcode scanning** (Release 2) will need WeChat JS-SDK inside WeChat WebView, not the Camera API.
- **TanStack Intent** requires an initialized project (package.json + installed deps) to discover
  and load skills; run its setup once the app is scaffolded (see `AGENTS.md`).

## Alternatives considered

- **SvelteKit + shadcn-svelte**: matches existing specs; Svelte ships an autofixing MCP server
  (excellent agent tooling). Rejected only because shadcn/ui (React) was chosen as the UI library.
- **React Router v7 (Remix)**: deepest Cloudflare integration, most mature React option.
  Close runner-up; TanStack Start chosen for its native TanStack Query offline/optimistic story
  and stronger type-safe routing.
- **Next.js**: weakest Cloudflare fit, hardest to relocate for Phase 2. Rejected.
- **All-Cloudflare incl. WeChat**: not viable (ICP filing + latency).
- **Tencent CloudBase from day one / WorkBuddy**: deferred to Phase 2; adds cost/complexity before
  MVP validation. WorkBuddy is an AI app-builder subscription (CloudBase-backed), not a fit for this
  detailed, spec-driven project.
