# Self-hosted OpenBookCorner — single Bun image serving the SPA + API.
# Multi-stage: install deps + build the SPA, then a lean runtime that runs
# apps/app/server.selfhost.ts (libsql SQLite + local-FS covers) with Bun.

# ---------- build ----------
FROM oven/bun:1.4.3-alpine AS build
WORKDIR /app

# Install workspace deps (lockfile-driven). Copy manifests first for caching.
COPY package.json bun.lock ./
COPY apps/app/package.json apps/app/
COPY apps/api/package.json apps/api/
COPY db/package.json db/
COPY e2e/package.json e2e/
RUN bun install --frozen-lockfile

# Copy source + build the SPA (dist/).
COPY . .
RUN bun --cwd apps/app generate-routes && bun --filter @obc/app build

# ---------- runtime ----------
FROM oven/bun:1.4.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    ENVIRONMENT=production \
    DB_PATH=/data/obc.db \
    COVERS_DIR=/data/covers \
    PORT=3000

# App needs: node_modules (workspace deps), the built SPA, server + reused
# source (routers/services/schema are TS, run directly by Bun).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/db ./db
COPY --from=build /app/package.json ./package.json

VOLUME /data
EXPOSE 3000
# Bun runs the TS entry directly (resolves workspace packages + TS at runtime).
CMD ["bun", "run", "apps/app/server.selfhost.ts"]
