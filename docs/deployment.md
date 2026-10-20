# Architecture & Deployment

How OpenBookCorner is put together and how to run it on your own Cloudflare
account. For the dev workflow see [`development.md`](./development.md); for the
product see the [README](../README.md).

## Architecture

```
          ┌──────────────────────────── Cloudflare ────────────────────────────┐
browser ─▶│  Worker "openbookcorner" (apps/app)                                │
          │   • serves the built React SPA (static assets)                     │
          │   • forwards /api/* ──service binding──▶ Worker "openbookcorner-api"│
          │                                            (apps/api, Hono)         │
          │                                              • Better Auth /api/auth│
          │                                              • D1 binding DB        │
          │                                              • R2 binding COVERS    │
          └────────────────────────────────────────────────────────────────────┘
                         D1 (SQLite)            R2 (book covers)
```

- **Two Workers, one origin.** The public Worker (`openbookcorner`) serves the
  SPA and proxies `/api/*` to the API Worker (`openbookcorner-api`) via a
  **service binding** — same origin, so auth cookies "just work".
- **Data**: Cloudflare **D1** (SQLite) via Drizzle; **R2** for book cover images.
- **Auth**: Better Auth (email/password) at `/api/auth/*`; sessions in D1.
- **Multi-tenant**: one database, every row scoped by `libraryId`; tenants are
  reached at `/t/:slug`. Isolation is enforced in the API middleware, not the DB.
- **Roles**: super_admin (system-wide) / library_admin / library_reader.

## Prerequisites

- A Cloudflare account (free tier is enough for small libraries).
- `bun install` done; Wrangler available (`bunx wrangler`).
- Authenticate Wrangler: `bunx wrangler login` (or set `CLOUDFLARE_API_TOKEN` +
  `CLOUDFLARE_ACCOUNT_ID` for non-interactive use).

## One-time resources

```bash
# D1 database (note the returned database_id → put it in wrangler config)
bunx wrangler d1 create openbookcorner
# R2 bucket for covers
bunx wrangler r2 bucket create openbookcorner-covers
```

Set the bindings in the API Worker's `wrangler.jsonc`: `DB` → your D1,
`COVERS` → your R2. The app Worker needs the `API` service binding → the API
Worker.

## Secrets

```bash
cd apps/api
bunx wrangler secret put BETTER_AUTH_SECRET   # a long random string (>=32 chars)
```

`ENVIRONMENT=production` (and `preview`) **fail closed** if `BETTER_AUTH_SECRET`
is missing — the Worker refuses to run rather than fall back to an insecure dev
key. `APP_ORIGIN` is the public origin in production (derived from the request in
preview/dev so per-PR hosts match Better Auth's cookies).

## Database migrations

```bash
# generate from the Drizzle schema (writes db/migrations)
bun --cwd db generate
# apply to the remote D1 (run from apps/api; migrations dir is ../../db/migrations)
cd apps/api && bunx wrangler d1 migrations apply openbookcorner --remote
```

Migrations are **forward-only, non-destructive ALTERs** by convention — a
drizzle-generated full-table rebuild violates FKs over the D1 HTTP API, so
hand-write a single `ALTER` when needed and fix the journal (see the 0010/0011
migrations for examples).

## Deploy

```bash
# API first (owns the D1 binding)
cd apps/api && bunx wrangler deploy
# then the app (builds the SPA + serves dist/, binds API)
cd apps/app && bun run build && bunx wrangler deploy
```

## First super admin

There is no public "create super admin" flow (by design). Create the first
account via sign-up, then promote it in D1:

```bash
cd apps/api
bunx wrangler d1 execute openbookcorner --remote \
  --command "UPDATE user SET role='super_admin' WHERE email='you@example.com';"
```

Then sign in → you land on the super-admin **Overview**. Create a library
(tenant), open it, **Add admin** to seed its first library_admin — that admin
then adds readers (or imports an existing library, or enables login for an
imported reader). New self-sign-ups default to `library_reader`.

## This repo's CI preview (reference)

The repo ships a GitHub Actions preview (`.github/workflows/preview.yml`) using
native **Worker Previews** — a single shared preview at
`preview.openbookcorner.jizu.dev` that every PR deploys over (last-deploy-wins),
bound to a **separate preview D1 + R2** (never production). The workflow: build
SPA → `d1 migrations apply DB --remote --preview` → `wrangler preview --name
preview` → seed demo users (`db/scripts/seed-users.sh`, idempotent, also
backfills any out-of-set roles) → comment the URL. It needs a repo secret
`CLOUDFLARE_API_TOKEN` (Workers Scripts/D1/R2 edit, Account read, Zone Workers
Routes edit); `BETTER_AUTH_SECRET` is set once on the Previews base config and
inherited. Production deploys on merge to `main`.

Demo accounts on preview (password `password123`): `reader@demo.test`,
`admin@demo.test`, `super@demo.test`.

## Cost

Free-tier limits (D1 100k reads/day, Workers 100k req/day, R2 10 GB) cover a
small library at **$0/month**; larger libraries pay low single/double-digit
dollars as they exceed the free tiers.
