#!/usr/bin/env bash
# Post-commit preview refresh for the Tailscale-reachable local preview.
#
# WHAT IT DOES (idempotent):
#   1. vite build (apps/app) — the worker serves apps/app/dist (no HMR)
#   2. cleanly restart `wrangler dev --local` on :8787 (kills the respawning
#      wrangler parent + workerd, waits for the port to free — avoids the
#      "Address already in use" loop)
#   3. keep a 0.0.0.0:8788 -> 127.0.0.1:8787 TCP forwarder up (wrangler binds
#      localhost-only, so this is what makes it reachable over Tailscale)
#   4. keep the local D1 state (seeded demo users) — does NOT wipe .wrangler/state
#
# USAGE:  scripts/preview-refresh.sh
# ACCESS: http://x13-arch.taild2386.ts.net:8788/  (http, not https)
#         demo logins: super@ / admin@ / reader@demo.test  (password123)
set -uo pipefail

ROOT="/home/jizu/OpenBookCorner"
APP_DIR="$ROOT/apps/app"
PORT=8787
PUB=8788
HOST="x13-arch.taild2386.ts.net"
ORIGIN="http://$HOST:$PUB"
SECRET="local-preview-secret-at-least-32-chars!!"
FWD="/tmp/obc-fwd.cjs"

export PATH="$HOME/.local/share/mise/shims:/home/jizu/.local/share/mise/installs/node/24.22.0/bin:$PATH"
export NO_PROXY=localhost,127.0.0.1
unset https_proxy http_proxy HTTPS_PROXY HTTP_PROXY 2>/dev/null || true

echo "==> [1/4] vite build"
( cd "$APP_DIR" && node_modules/.bin/tsr generate >/dev/null 2>&1; bun run build >/tmp/obc-build.log 2>&1 ) \
  && echo "    build ok" || { echo "    BUILD FAILED:"; tail -15 /tmp/obc-build.log; exit 1; }

echo "==> [2/4] restart worker on :$PORT"
# kill the wrangler parent (so it stops respawning workerd), then workerd
for wp in $(pgrep -x workerd); do
  pp=$(ps -o ppid= -p "$wp" 2>/dev/null | tr -d ' ')
  [ -n "$pp" ] && [ "$pp" != "1" ] && kill -9 "$pp" 2>/dev/null
done
pkill -9 -x workerd 2>/dev/null
for i in $(seq 1 15); do
  n=$( (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -c ":$PORT" )
  [ "$n" = "0" ] && break
  pkill -9 -x workerd 2>/dev/null; sleep 1
done
setsid bash -c "cd '$APP_DIR' && exec bunx wrangler dev --local --port $PORT \
  --var ENVIRONMENT:development --var APP_ORIGIN:$ORIGIN --var BETTER_AUTH_SECRET:$SECRET \
  >/tmp/obc-preview.log 2>&1" </dev/null >/dev/null 2>&1 &
disown
up=0
for i in $(seq 1 30); do
  sleep 2
  [ "$(curl -s -m3 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/login 2>/dev/null)" = "200" ] && { up=1; echo "    worker up (~$((i*2))s)"; break; }
done
[ "$up" = "1" ] || { echo "    WORKER DID NOT COME UP:"; grep -iE 'error|ready on' /tmp/obc-preview.log | tail -5; exit 1; }

echo "==> [3/4] ensure forwarder 0.0.0.0:$PUB -> 127.0.0.1:$PORT"
if [ "$( (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -c ":$PUB" )" = "0" ]; then
  cat > "$FWD" <<'JS'
const net=require('net');
const [,,IP,PORT,DST]=process.argv;
net.createServer(c=>{const u=net.connect(Number(DST),'127.0.0.1');c.pipe(u);u.pipe(c);c.on('error',()=>u.destroy());u.on('error',()=>c.destroy());})
.listen(Number(PORT),IP,()=>console.log(`fwd ${IP}:${PORT} -> 127.0.0.1:${DST}`));
JS
  setsid node "$FWD" 0.0.0.0 "$PUB" "$PORT" >/tmp/obc-fwd.log 2>&1 </dev/null &
  disown
  sleep 2
  echo "    forwarder started"
else
  echo "    forwarder already up"
fi

echo "==> [4/4] verify"
echo "    local  /login : $(curl -s -m5 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/login)"
echo "    tailnet /login : $(curl -s -m6 -o /dev/null -w '%{http_code}' $ORIGIN/login)"
echo ""
echo "Preview ready: $ORIGIN/   (http, demo: reader@/admin@/super@demo.test / password123)"
