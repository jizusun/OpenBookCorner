#!/usr/bin/env bash
# Seed the demo users (reader/admin/super) into a DEPLOYED OpenBookCorner D1.
#
# Why a script and not plain SQL: Better Auth stores a scrypt password hash in
# the `account` table, so users must be created through the running Worker's
# sign-up endpoint (not a hand-written INSERT). This script therefore:
#   1. POSTs /api/auth/sign-up/email on the deployment (idempotent — re-runs are
#      fine; an existing email just returns 4xx which we ignore), then
#   2. sets each user's library_id + role directly in D1 via `cf d1 query`.
#
# It is primarily meant for PREVIEW deployments, whose isolated D1
# (openbookcorner-preview) is NOT seeded with users by anything else. It is safe
# to point at any environment, but DO NOT run it against production unless you
# actually want demo accounts there.
#
# Usage:
#   db/scripts/seed-users.sh <ORIGIN> <D1_DATABASE_ID> [LIBRARY_ID]
#
# Env it respects (so it works behind the WSL/mihomo proxy):
#   HTTPS_PROXY / HTTP_PROXY ....... passed through to curl + cf/wrangler
#   CLOUDFLARE_ACCOUNT_ID ......... required by cf/wrangler in non-interactive mode
#   CLOUDFLARE_API_TOKEN .......... when set (e.g. in CI), the role-patch step uses
#                                   `wrangler d1 execute <D1_NAME> --remote` instead
#                                   of `cf d1 query` (cf needs interactive OAuth).
#   SEED_D1_NAME .................. D1 database NAME for the wrangler path
#                                   (default: openbookcorner-preview)
#   SEED_PASSWORD ................. demo password (default: password123)
#
# Example (local, cf/OAuth):
#   export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890
#   export CLOUDFLARE_ACCOUNT_ID=69f6e3b623318562cf2917e23251be5d
#   db/scripts/seed-users.sh \
#     https://preview.openbookcorner.jizu.dev \
#     6d67a9a0-0ac1-4c50-bbef-6c035e3300a7
#
# Example (CI, API token):
#   CLOUDFLARE_API_TOKEN=*** CLOUDFLARE_ACCOUNT_ID=*** \
#   db/scripts/seed-users.sh https://preview.openbookcorner.jizu.dev 6d67a9a0-...
set -euo pipefail

ORIGIN="${1:?Usage: seed-users.sh <ORIGIN> <D1_DATABASE_ID> [LIBRARY_ID]}"
D1_ID="${2:?Usage: seed-users.sh <ORIGIN> <D1_DATABASE_ID> [LIBRARY_ID]}"
LIBRARY_ID="${3:-lib-demo-001}"
PASSWORD="${SEED_PASSWORD:-password123}"
D1_NAME="${SEED_D1_NAME:-openbookcorner-preview}"

# cf lives in the repo (installed via the project toolchain). Prefer a local
# binary, fall back to PATH.
CF="cf"

echo "Seeding demo users into ${ORIGIN} (D1 ${D1_ID}, library ${LIBRARY_ID})"

signup() {
  local email="$1" name="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${ORIGIN}/api/auth/sign-up/email" \
    -H "Origin: ${ORIGIN}" -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\",\"name\":\"${name}\"}")
  # 200 = created; 4xx = already exists (idempotent) — both acceptable.
  if [[ "$code" == "200" ]]; then
    echo "  created ${email}"
  elif [[ "$code" =~ ^4 ]]; then
    echo "  ${email} already exists (skip)"
  else
    echo "  ERROR signing up ${email}: HTTP ${code}" >&2
    exit 1
  fi
}

signup "reader@demo.test" "Demo Reader"
signup "admin@demo.test"  "Demo Admin"
signup "super@demo.test"  "Demo Super Admin"

echo "Attaching library + roles..."
roles_sql="
  UPDATE user SET library_id='${LIBRARY_ID}', role='library_admin'  WHERE email='admin@demo.test';
  UPDATE user SET library_id='${LIBRARY_ID}', role='library_reader' WHERE email='reader@demo.test';
  UPDATE user SET library_id='${LIBRARY_ID}', role='super_admin'    WHERE email='super@demo.test';
"

run_roles() {
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    # CI / token path: wrangler authenticates with CLOUDFLARE_API_TOKEN and
    # addresses D1 by NAME (not id).
    bunx wrangler d1 execute "$D1_NAME" --remote --command "$roles_sql" >/dev/null 2>&1
  else
    # Local path: cf uses interactive OAuth and addresses D1 by id.
    "$CF" d1 query "$D1_ID" --sql "$roles_sql" >/dev/null 2>&1
  fi
}

attempt=0
until run_roles; do
  attempt=$((attempt + 1))
  if [[ "$attempt" -ge 5 ]]; then
    echo "  ERROR: role update failed after ${attempt} attempts (check CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / HTTPS_PROXY)" >&2
    exit 1
  fi
  echo "  role update failed (attempt ${attempt}) — retrying in 3s..." >&2
  sleep 3
done

echo "Done. Demo accounts (password: ${PASSWORD}):"
echo "  reader@demo.test  (library_reader)"
echo "  admin@demo.test   (library_admin)"
echo "  super@demo.test   (super_admin)"
