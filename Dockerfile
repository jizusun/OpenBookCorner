# Self-hosted OpenBookCorner — LAYERED image.
# The Bun runtime lives in the base image layer (changes rarely → cached). The
# app ships as a small bundled JS file (`bun build`, ~3 MB, no node_modules) in
# its own layer, and the SPA in another. Rebuilding after a code change only
# replaces the tiny app/SPA layers, not the runtime.

# ---------- build ----------
FROM oven/bun:1.4.3-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/app/package.json apps/app/
COPY apps/api/package.json apps/api/
COPY db/package.json db/
COPY e2e/package.json e2e/
RUN bun install --frozen-lockfile

COPY . .
# 1) build the SPA  2) bundle the server to a single JS file (deps inlined,
#    tree-shaken; NO node_modules, NOT a compiled binary — the Bun runtime is
#    provided by the base image at runtime).
RUN bun --cwd apps/app generate-routes \
 && bun --filter @obc/app build \
 && bun build apps/app/server.selfhost.ts --target bun --outfile /app/server.js

# ---------- runtime ----------
# Base layer = Bun runtime (cached across builds). Then the SPA layer, then the
# app-code layer last (smallest + changes most often → best cache behavior).
FROM oven/bun:1.4.3-alpine AS runtime
WORKDIR /app
ENV ENVIRONMENT=production \
    DB_PATH=/data/obc.db \
    DIST_DIR=/app/dist \
    PORT=3000

# SPA layer (changes less often than nothing here, but kept separate from code).
COPY --from=build /app/apps/app/dist /app/dist
# App code layer — the ~3 MB bundled JS (last = most-frequently-rebuilt).
COPY --from=build /app/server.js /app/server.js

VOLUME /data
EXPOSE 3000
CMD ["bun", "run", "/app/server.js"]
