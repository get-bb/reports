#!/usr/bin/env bash
# get-bb/bb#1334 cross-check: can the server and the primary host daemon run as
# SEPARATE top-level processes on one machine today (so an operator could give
# them different systemd units / cgroups)?  Uses only packaged bb-app entry
# points: dist/bb-server.js (server only) and `bb-app host-daemon join`.
#
# usage: split-deploy-check.sh <worktree> <serverPort> <daemonPort> <outdir>
set -u
WT=$1; SPORT=$2; DPORT=$3; OUT=$4
mkdir -p "$OUT"
SDATA=$OUT/server-data; DDATA=$OUT/daemon-data
rm -rf "$SDATA" "$DDATA"
node "$WT/packages/bb-app/dist/bb-server.js" --data-dir "$SDATA" --server-port "$SPORT" \
  > "$OUT/server.out" 2>&1 &
SERVER_PID=$!
echo "bb-server pid $SERVER_PID"
for i in $(seq 1 60); do
  curl -sf --max-time 2 "http://127.0.0.1:$SPORT/health" >/dev/null 2>&1 && break
  sleep 1
done
echo "--- /health after server-only start"
curl -s --max-time 5 "http://127.0.0.1:$SPORT/health"; echo
echo "--- /api/v1/hosts with only bb-server running (expect [] : no daemon was spawned)"
curl -s --max-time 5 "http://127.0.0.1:$SPORT/api/v1/hosts"; echo
echo "--- process tree of bb-server (no host-daemon child expected)"
ps -o pid,ppid,cmd -p "$SERVER_PID" | cut -c1-160
ps -o pid,ppid,cmd --ppid "$SERVER_PID" | cut -c1-160
SP=$(pgrep -f "server/dist.*" -P "$SERVER_PID" | head -1)
[ -n "$SP" ] && ps -o pid,ppid,cmd --ppid "$SP" | cut -c1-160
echo "--- cgroup of server:"; cat "/proc/$SERVER_PID/cgroup"

node "$WT/packages/bb-app/dist/bb-app.js" --data-dir "$DDATA" --host-daemon-port "$DPORT" \
  host-daemon join --server-url "http://127.0.0.1:$SPORT" > "$OUT/daemon.out" 2>&1 &
DAEMON_PID=$!
echo "bb-app host-daemon join pid $DAEMON_PID"
hosts=""
for i in $(seq 1 90); do
  hosts=$(curl -s --max-time 2 "http://127.0.0.1:$SPORT/api/v1/hosts")
  echo "$hosts" | grep -q '"connected"' && break
  sleep 1
done
echo "--- /api/v1/hosts after host-daemon join"
echo "$hosts"; echo
echo "--- daemon log (tail)"
tail -n 8 "$OUT/daemon.out" | cut -c1-220
echo "--- daemon process cgroup (a systemd unit could give this a different one):"
cat "/proc/$DAEMON_PID/cgroup"
echo "--- stopping"
pkill -P "$DAEMON_PID"; pkill -P "$SERVER_PID"; kill "$DAEMON_PID" "$SERVER_PID" 2>/dev/null
sleep 3
pkill -f "$SDATA" 2>/dev/null; pkill -f "$DDATA" 2>/dev/null
echo done
