# Self-hosting OpenBookCorner

Run OpenBookCorner on a small, cheap VPS or SBC (e.g. an Armbian board) instead
of Cloudflare — useful for **low latency in China** and **minimal cost**. The
same app (Hono + tRPC + Better Auth + the React SPA) runs with self-hostable
primitives:

| Cloudflare | Self-hosted |
|---|---|
| Workers runtime | **Bun** (`oven/bun`) |
| D1 (SQLite) | **`bun:sqlite`** file on a volume |
| R2 object storage | **Cloudflare R2 public CDN** for cover images (not stored on the box) |
| Wrangler deploy | **Docker Compose** |
| D1 time-travel backup | **Litestream** (continuous SQLite backup to object storage) |

> The Cloudflare path (`apps/app/worker.ts`, D1, Worker Previews) is untouched.
> Self-hosting is a **parallel entry** (`apps/app/server.selfhost.ts`), selected
> at deploy time. You can run either, or both.

## What's in the image

A **layered** Docker image (~150 MB total):

- **Bun runtime** — base layer (`oven/bun:1.4.3-alpine`, ~82 MB), rarely changes → cached.
- **App bundle** — `bun build` of the server to a single ~3 MB JS file (deps inlined, no `node_modules`), its own layer.
- **SPA** — the built React app (~1.6 MB), its own layer.

Rebuilding after a code change only replaces the small app/SPA layers, so
pulling an update to the box transfers a few MB, not the whole image.

> The Bun runtime (~82 MB) is a fixed floor; the app itself is only ~3 MB. A
> single compiled binary (`bun build --compile`) is about the same total size
> (~148 MB) but updates worse (whole binary layer changes), so we use the layered
> image.

## Prerequisites

- A host with **Docker + Docker Compose**.
- **~300 MB free disk** (image ~150 MB + SQLite DB + headroom). The DB itself is
  tiny (the full 番薯 dataset is only a few MB).
- Cover images are served from your **R2 public CDN**, so they don't consume
  disk on the box.

> **Architecture note:** build the image for your host's CPU. On an ARM board
> (aarch64) you need an **arm64** image — build on the board, or cross-build with
> `docker buildx build --platform linux/arm64 ...` and push to a registry. The
> `docker build` in this repo produces an image for the builder's architecture.

## Quick start

```sh
# 1. Configure
cp .env.example .env
# edit .env — at minimum set APP_ORIGIN and a strong BETTER_AUTH_SECRET:
#   openssl rand -base64 48

# 2. Build + run
docker compose up -d --build

# 3. Apply the database schema (first run only — see "Database schema" below)

# 4. Open APP_ORIGIN (e.g. http://<host>:3000)
```

## Configuration (env)

Set in `.env` (consumed by `docker-compose.yml`):

| Var | Required | Default | Notes |
|---|---|---|---|
| `APP_ORIGIN` | **yes** | — | Public URL users reach, e.g. `https://library.example.com` or `http://<host>:3000`. Must match the real origin for Better Auth cookies/CSRF. |
| `BETTER_AUTH_SECRET` | **yes** | — | 32+ char random string (`openssl rand -base64 48`). Signs sessions. |
| `APP_NAME` | no | `OpenBookCorner` | Display name. |
| `DB_PATH` | no | `/data/obc.db` | SQLite file on the `data` volume. |
| `DIST_DIR` | no | `/app/dist` | Built SPA location in the image. |
| `PORT` | no | `3000` | Listen port. |
| `LITESTREAM_ENDPOINT` / `LITESTREAM_BUCKET` / `LITESTREAM_ACCESS_KEY_ID` / `LITESTREAM_SECRET_ACCESS_KEY` | for backups | — | S3-compatible target (R2/B2/MinIO). |

The app listens on `:3000`. Put a TLS-terminating reverse proxy (Caddy / Nginx /
Cloudflare Tunnel) in front for HTTPS and set `APP_ORIGIN` to that URL.

## Database schema (first run)

The self-host entry opens the SQLite file but **does not auto-create tables yet**
(known TODO). Apply the Drizzle migrations in `db/migrations/` to `DB_PATH`
before first use, e.g. from a machine with the repo:

```sh
# point drizzle/better-sqlite at the file and apply db/migrations/*.sql
# (or run the SQL files in order against /data/obc.db with any sqlite client)
```

> Roadmap: run migrations automatically on boot so this step disappears.

## Backups — Litestream

SQLite is a single file, and [Litestream](https://litestream.io) streams every
write to S3-compatible object storage **continuously** (near-real-time), with
point-in-time restore. It's the `litestream` service in `docker-compose.yml` and
reads `litestream.yml`.

- **Configure:** set `LITESTREAM_*` in `.env` and the bucket/endpoint in
  `litestream.yml` (R2/B2/MinIO all work; a few MB of DB fits free tiers).
- **Restore** (after a disk loss / new box):

  ```sh
  litestream restore -o /data/obc.db \
    s3://<bucket>/obc.db   # same endpoint/creds as the replica config
  ```

- Backup is optional: comment out the `litestream` service to skip it.

## Updating

```sh
git pull
docker compose up -d --build   # rebuilds only the small app/SPA layers
```

## Covers

Book covers are served from your **Cloudflare R2 public CDN** URL, not the box —
this keeps the small disk free and offloads image bandwidth to Cloudflare's CDN
(fast globally and in China). Stored cover URLs are absolute R2 URLs the SPA
renders directly.

> The cover **write** path (admin "Add Book" → store to R2) still uses the
> Cloudflare R2 binding; on a pure self-host box without R2 that step is a no-op
> (the external URL is kept). The 番薯 **import** does not store covers, so
> importing a library works fully self-hosted.

## Known limitations / roadmap

- [ ] Auto-apply DB migrations on boot (currently a manual first-run step).
- [ ] Local cover **write** adapter (store uploaded covers on disk/MinIO instead
      of R2) for a fully Cloudflare-free deployment.
- [ ] First-class **arm64** image in CI (for ARM boards).
