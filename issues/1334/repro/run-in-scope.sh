#!/usr/bin/env bash
# Runs the packaged bb-app launcher (server + primary host daemon) inside ONE
# systemd user scope with cgroup-v2 memory limits, the way a `bb.service` unit
# with MemoryHigh/MemoryMax does, then starts a memory hog in the SAME cgroup
# (standing in for an agent-launched descendant) and probes /health.
#
# Invoke through systemd-run so everything below lands in one cgroup:
#   systemd-run --user --scope -p MemoryHigh=<X> -p MemoryMax=<Y> -p MemorySwapMax=<Z> \
#     run-in-scope.sh <worktree> <dataDir> <serverPort> <daemonPort> <hogMiB> <holdSeconds>
set -u
WT=$1; DATA=$2; SPORT=$3; DPORT=$4; HOG=$5; HOLD=$6
CG=/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup)
echo "cgroup: $CG"
echo "memory.high=$(cat $CG/memory.high) memory.max=$(cat $CG/memory.max) memory.swap.max=$(cat $CG/memory.swap.max)"
mkdir -p "$DATA"
node "$WT/packages/bb-app/dist/bb-app.js" --data-dir "$DATA" --server-port "$SPORT" --host-daemon-port "$DPORT" > "$DATA/launcher.out" 2>&1 &
LAUNCHER=$!
echo "launcher pid $LAUNCHER"
for i in $(seq 1 90); do
  if curl -fs --max-time 2 "http://127.0.0.1:$SPORT/health" >/dev/null; then echo "server healthy after ${i}s"; break; fi
  sleep 1
done
sleep 8
echo "--- baseline: every process in the scope and its cgroup"
for p in $(cat $CG/cgroup.procs); do printf '%s\t%s\t%s\n' "$p" "$(cat /proc/$p/cgroup 2>/dev/null)" "$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | cut -c1-110)"; done
echo "--- baseline memory.current=$(cat $CG/memory.current) events: $(tr '\n' ' ' < $CG/memory.events)"
echo "--- baseline health latency"
for i in 1 2 3; do curl -s -o /dev/null -w "server /health -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/health"; done
curl -s -o /dev/null -w "daemon /       -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$DPORT/"
echo "--- starting a light API load loop (what a browser tab / CLI would do)"
( while :; do curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/threads"; curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/projects"; sleep 0.2; done ) &
LOADPID=$!
echo "--- starting memhog ($HOG MiB, hold ${HOLD}s) inside the same cgroup"
node "$(dirname "$0")/memhog.mjs" "$HOG" "$HOLD" > "$DATA/memhog.out" 2>&1 &
HOGPID=$!
sleep 15
for round in $(seq 1 15); do
  echo "=== t+$((15 + (round-1)*10))s memory.current=$(cat $CG/memory.current) high=$(cat $CG/memory.high) swap.current=$(cat $CG/memory.swap.current)"
  echo "memory.events: $(tr '\n' ' ' < $CG/memory.events)"
  echo "memory.pressure: $(head -2 $CG/memory.pressure | tr '\n' ' ')"
  curl -s -o /dev/null -w "server  /health  -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/health" || echo "server  /health  -> TIMEOUT/ERR (curl exit $?)"
  curl -s -o /dev/null -w "daemon  /        -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$DPORT/" || echo "daemon  /        -> TIMEOUT/ERR (curl exit $?)"
  for p in $(cat $CG/cgroup.procs); do
    st=$(awk '{print $3}' /proc/$p/stat 2>/dev/null); wc=$(cat /proc/$p/wchan 2>/dev/null)
    printf '  pid %s state=%s wchan=%s %s\n' "$p" "$st" "$wc" "$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | cut -c1-60)"
  done
  sleep 10
done
kill $HOGPID 2>/dev/null; wait $HOGPID 2>/dev/null
kill $LOADPID 2>/dev/null
echo "--- after hog exit"
sleep 5
curl -s -o /dev/null -w "server  /health  -> %{http_code} in %{time_total}s\n" --max-time 10 "http://127.0.0.1:$SPORT/health" || echo "server /health still failing"
kill -INT $LAUNCHER; wait $LAUNCHER
echo "launcher exited"
