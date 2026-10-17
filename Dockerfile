# Self-hosted OpenBookCorner — compiled single-binary image.
# Build stage compiles the backend to ONE executable (`bun build --compile`,
# using bun:sqlite so there are no external native .node files) and builds the
# SPA. The runtime stage ships ONLY the binary + the static SPA on a tiny base,
# so the image is far smaller than shipping node_modules.

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
# Build the SPA, then compile the self-host server to a single executable.
RUN bun --cwd apps/app generate-routes \
 && bun --filter @obc/app build \
 && bun build apps/app/server.selfhost.ts --compile --target bun --outfile /app/obc-selfhost

# ---------- runtime ----------
# Distroless-ish small base. The compiled binary bundles the Bun runtime, so we
# don't need Bun/Node installed here — just a libc + the binary + the SPA.
FROM alpine:3.20 AS runtime
WORKDIR /app
RUN apk add --no-cache libstdc++ libgcc ca-certificates
ENV ENVIRONMENT=production \
    DB_PATH=/data/obc.db \
    DIST_DIR=/app/dist \
    PORT=3000

COPY --from=build /app/obc-selfhost /app/obc-selfhost
COPY --from=build /app/apps/app/dist /app/dist

VOLUME /data
EXPOSE 3000
# The compiled binary serves the SPA from ./dist (relative to its own dir).
CMD ["/app/obc-selfhost"]
