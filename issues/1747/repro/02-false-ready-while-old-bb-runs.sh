#!/usr/bin/env bash
# Repro for the real bb bug found while investigating #1747: when a user follows
# the in-app upgrade command (`npx bb-app@latest`) while the old bb is still
# running on the same data dir/ports, the NEW launcher prints "bb is ready" with
# the app URL, but its own server/daemon children crash with EADDRINUSE /
# "Lock file is already being held" in an endless restart loop, and the URL
# still serves the OLD version. Nothing was updated, but the terminal says ready.
#
# Prerequisites: run 01-npx-latest-re-resolves.sh first (it creates the npx cache
# entry this script downgrades); ports 49901/49902 must be free; needs network
# (~130 MB of bb-app tarballs) and about one minute.
set -euo pipefail
export npm_config_cache=/tmp/bb-1747-npx/npm-cache npm_config_update_notifier=false BB_TELEMETRY=false
HASH=$(node -e 'console.log(require("crypto").createHash("sha512").update("bb-app@latest").digest("hex").slice(0,16))')
DIR="$npm_config_cache/_npx/$HASH"
DATA=/tmp/bb-1747-npx/data; PORT=49901; DPORT=49902
[ -f "$DIR/package.json" ] || { echo "npx cache entry $DIR missing - run 01-npx-latest-re-resolves.sh first" >&2; exit 2; }
for p in $PORT $DPORT; do
  if curl -s -o /dev/null "http://127.0.0.1:$p/" 2>/dev/null; then echo "port $p is already in use - pick free ports" >&2; exit 2; fi
done
mkdir -p "$DATA"

echo "== 1. put 0.35.1 in the npx cache entry and start it (the 'old' bb)"
npm install --prefix "$DIR" --no-audit --no-fund bb-app@0.35.1 >/dev/null 2>&1
node "$DIR/node_modules/bb-app/dist/bb-app.js" --data-dir "$DATA" --server-port $PORT --host-daemon-port $DPORT > /tmp/bb-1747-npx/old.log 2>&1 &
OLD=$!
until curl -sf http://127.0.0.1:$PORT/health >/dev/null; do sleep 1; done
curl -s http://127.0.0.1:$PORT/api/v1/system/version; echo   # currentVersion 0.35.1, upgradeCommand "npx bb-app@latest"

echo "== 2. do what the Updates page tells you, in a second terminal, without stopping the old bb"
timeout 45 npx -y bb-app@latest --data-dir "$DATA" --server-port $PORT --host-daemon-port $DPORT > /tmp/bb-1747-npx/new.log 2>&1 || true
tr '\r' '\n' < /tmp/bb-1747-npx/new.log | grep -E "already runs|bb is ready|EADDRINUSE|Lock file|restarting" | sort | uniq -c

echo "== 3. what the app URL actually serves"
curl -s http://127.0.0.1:$PORT/api/v1/system/version; echo   # still 0.35.1
grep '"version"' "$DIR/node_modules/bb-app/package.json"       # but the cache dir is now 0.38.0

node "$DIR/node_modules/bb-app/dist/bb-app.js" stop --data-dir "$DATA" || kill $OLD
