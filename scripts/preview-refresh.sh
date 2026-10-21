#!/usr/bin/env bash
# Post-commit preview refresh for the Tailscale-reachable local preview.
#
# WHAT IT DOES (idempotent):
#   1. vite build (apps/app)
#   2. Renew the Tailscale TLS cert (tailscale cert, no-op if unchanged)
#   3. Cleanly restart wrangler dev --local on :8787
#      --persist-to .wrangler/state-preview  ← ISOLATED from the E2E state
#   4. Keep a Node HTTPS reverse proxy (Tailscale cert) on :8443 -> :8787
#   5. DATA IS NEVER WIPED — preview DB persists across restarts
#
# USAGE:  scripts/preview-refresh.sh
# ACCESS: https://x13-arch.taild2386.ts.net:8443/
#         demo logins: super@ / admin@ / reader@demo.test  (password123)
set -uo pipefail

ROOT="/home/jizu/OpenBookCorner"
APP_DIR="$ROOT/apps/app"
PORT=8787
HTTPS_PORT=8443
HOST="x13-arch.taild2386.ts.net"
ORIGIN="https://$HOST:$HTTPS_PORT"
SECRET="local-preview-secret-at-least-32-chars!!"
CERT="/tmp/tscerts/$HOST.crt"
KEY="/tmp/tscerts/$HOST.key"
PROXY_SCRIPT="/tmp/https-proxy.cjs"
# Isolated state dir — E2E uses .wrangler/state-e2e, preview uses state-preview.
PREVIEW_STATE=".wrangler/state-preview"

export PATH="$HOME/.local/share/mise/shims:/home/jizu/.local/share/mise/installs/node/24.22.0/bin:$PATH"
export NO_PROXY=localhost,127.0.0.1
unset https_proxy http_proxy HTTPS_PROXY HTTP_PROXY 2>/dev/null || true

echo "==> [1/5] vite build"
( cd "$APP_DIR" && node_modules/.bin/tsr generate >/dev/null 2>&1 && bun run build >/tmp/obc-build.log 2>&1 ) \
  && echo "    build ok" || { echo "    BUILD FAILED:"; tail -15 /tmp/obc-build.log; exit 1; }

echo "==> [2/5] Tailscale TLS cert"
mkdir -p /tmp/tscerts
tailscale cert --cert-file "$CERT" --key-file "$KEY" "$HOST" 2>&1 | head -1 || true
openssl x509 -in "$CERT" -noout -enddate 2>/dev/null | sed 's/^/    /'

echo "==> [3/5] restart worker on :$PORT (state: $APP_DIR/$PREVIEW_STATE)"
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

# Apply migrations to the PREVIEW DB (idempotent — safe on every refresh).
( cd "$APP_DIR" && echo y | bunx wrangler d1 migrations apply openbookcorner \
    --local --persist-to "$PREVIEW_STATE" >/dev/null 2>&1 ) && echo "    migrations ok"

setsid bash -c "cd '$APP_DIR' && exec bunx wrangler dev --local --port $PORT \
  --persist-to '$PREVIEW_STATE' \
  --var ENVIRONMENT:development --var APP_ORIGIN:$ORIGIN --var BETTER_AUTH_SECRET:$SECRET \
  >/tmp/obc-preview.log 2>&1" </dev/null >/dev/null 2>&1 &
disown
up=0
for i in $(seq 1 30); do
  sleep 2
  [ "$(curl -s -m3 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/login 2>/dev/null)" = "200" ] && { up=1; echo "    worker up (~$((i*2))s)"; break; }
done
[ "$up" = "1" ] || { echo "    WORKER DID NOT COME UP:"; grep -iE 'error|ready on' /tmp/obc-preview.log | tail -5; exit 1; }

echo "==> [4/5] HTTPS proxy :$HTTPS_PORT -> :$PORT"
cat > "$PROXY_SCRIPT" << 'JS'
const https=require('https'),http=require('http'),fs=require('fs')
const [,,CERT,KEY,BIND_IP,BIND_PORT,DST_PORT]=process.argv
const opts={cert:fs.readFileSync(CERT),key:fs.readFileSync(KEY)}
https.createServer(opts,(req,res)=>{
  const pr=http.request({hostname:'127.0.0.1',port:+DST_PORT,path:req.url,method:req.method,
    headers:{...req.headers,host:req.headers.host||'127.0.0.1:'+DST_PORT}},
    ps=>{res.writeHead(ps.statusCode??200,ps.headers);ps.pipe(res)})
  pr.on('error',()=>res.end());req.pipe(pr)
}).listen(+BIND_PORT,BIND_IP,()=>console.log(`TLS ${BIND_IP}:${BIND_PORT}->${DST_PORT}`))
JS
TS_IP=$(tailscale ip -4 2>/dev/null | head -1 || echo "127.0.0.1")
FP=$( (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep ":$HTTPS_PORT " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
[ -n "$FP" ] && kill -9 "$FP" 2>/dev/null
sleep 1
setsid node "$PROXY_SCRIPT" "$CERT" "$KEY" "$TS_IP" "$HTTPS_PORT" "$PORT" >/tmp/obc-https-proxy.log 2>&1 </dev/null &
disown; sleep 2
cat /tmp/obc-https-proxy.log

echo "==> [5/5] verify"
echo "    local  /login: $(curl -s -m5 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/login)"
echo "    HTTPS  /login: $(curl -s -m6 -o /dev/null -w '%{http_code}' $ORIGIN/login)"
echo ""
echo "Preview ready: $ORIGIN/   (HTTPS ✓  demo: reader@/admin@/super@demo.test / password123)"
echo "Preview DB:    $APP_DIR/$PREVIEW_STATE  (never wiped by E2E)"
