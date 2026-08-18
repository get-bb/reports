#!/usr/bin/env bash
# get-bb/bb#1334 cross-check variant: server and primary daemon as separate
# top-level processes sharing ONE data dir (the same layout the full-stack
# launcher produces, so <dataDir>/host-id exists and the server's primary-host
# resolution is unambiguous).
#
# NOTE: `bb-app host-daemon` (start) takes its server URL from managed config,
# not --server-port, and refuses to start un-enrolled; so this uses `join`.
# usage: split-deploy-check-shared.sh <worktree> <serverPort> <daemonPort> <outdir>
set -u
WT=$1; SPORT=$2; DPORT=$3; OUT=$4
mkdir -p "$OUT"
DATA=$OUT/shared-data
rm -rf "$DATA"
node "$WT/packages/bb-app/dist/bb-server.js" --data-dir "$DATA" --server-port "$SPORT" \
  > "$OUT/server.out" 2>&1 &
SERVER_PID=$!
echo "bb-server pid $SERVER_PID"
for i in $(seq 1 60); do
  curl -sf --max-time 2 "http://127.0.0.1:$SPORT/health" >/dev/null 2>&1 && break
  sleep 1
done
echo "--- /api/v1/hosts with only bb-server running"
curl -s --max-time 5 "http://127.0.0.1:$SPORT/api/v1/hosts"; echo
echo "--- primaryHostId from /api/v1/system/config before daemon"
curl -s --max-time 5 "http://127.0.0.1:$SPORT/api/v1/system/config" | tr ',' '\n' | grep -io "\"primaryHostId\":[^,]*"

node "$WT/packages/bb-app/dist/bb-app.js" --data-dir "$DATA" \
  --host-daemon-port "$DPORT" host-daemon join --server-url "http://127.0.0.1:$SPORT" > "$OUT/daemon.out" 2>&1 &
DAEMON_PID=$!
echo "bb-app host-daemon join (same data dir) pid $DAEMON_PID"
hosts=""
for i in $(seq 1 90); do
  hosts=$(curl -s --max-time 2 "http://127.0.0.1:$SPORT/api/v1/hosts")
  echo "$hosts" | grep -q '"connected"' && break
  sleep 1
done
echo "--- /api/v1/hosts after bb-app host-daemon"
echo "$hosts"; echo
echo "--- host-id file in shared data dir:"; cat "$DATA/host-id"; echo
echo "--- primaryHostId from /api/v1/system/config after daemon"
curl -s --max-time 5 "http://127.0.0.1:$SPORT/api/v1/system/config" | tr ',' '\n' | grep -io "\"primaryHostId\":[^,]*"
echo "--- daemon log (tail)"
tail -n 6 "$OUT/daemon.out" | cut -c1-220
echo "--- stopping"
pkill -P "$DAEMON_PID"; pkill -P "$SERVER_PID"; kill "$DAEMON_PID" "$SERVER_PID" 2>/dev/null
sleep 3
pkill -f "$DATA" 2>/dev/null
echo done
