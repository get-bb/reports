#!/usr/bin/env bash
# Repro for get-bb/bb#1334: run the packaged bb-app launcher (server + primary
# host daemon, exactly what `npx bb-app` / a bb.service unit runs) inside ONE
# systemd user scope with cgroup-v2 memory limits, then start a memory hog in
# the SAME cgroup (stand-in for an agent-launched descendant such as a browser
# automation daemon) and probe the control-plane endpoints.
#
# Invoke through systemd-run so everything lands in one cgroup:
#   systemd-run --user --scope -p MemoryHigh=800M -p MemoryMax=2200M -p MemorySwapMax=64M \
#     run-in-scope-v2.sh <worktree> <dataDir> <serverPort> <daemonPort> <hogMiB> <holdSeconds>
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
sleep 10
role() { # pid -> role label
  local c; c=$(tr '\0' ' ' < /proc/$1/cmdline 2>/dev/null)
  case "$c" in
    *bb-app.js*) echo launcher;; *apps/server*|*server-bundle*|*server/dist*) echo server;;
    *daemon-bundle*|*host-daemon*) echo daemon;; *plugin-host*|*worker*) echo plugin-worker;;
    *memhog*) echo MEMHOG;; *run-in-scope*) echo script;; *curl*) echo curl;; *) echo "other";;
  esac
}
dump_procs() {
  for p in $(cat $CG/cgroup.procs); do
    st=$(awk '{print $3}' /proc/$p/stat 2>/dev/null); wc=$(cat /proc/$p/wchan 2>/dev/null)
    [ -z "$st" ] && continue
    printf '  pid %-8s role=%-13s state=%s wchan=%s\n' "$p" "$(role $p)" "$st" "$wc"
  done
}
echo "--- baseline processes in the scope"
for p in $(cat $CG/cgroup.procs); do printf '  %s\t%s\t%s\n' "$p" "$(role $p)" "$(tr '\0' ' ' < /proc/$p/cmdline 2>/dev/null | cut -c1-140)"; done
echo "--- baseline memory.current=$(cat $CG/memory.current) events: $(tr '\n' ' ' < $CG/memory.events)"
echo "--- baseline latency"
for i in 1 2 3; do curl -s -o /dev/null -w "server /health           -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/health"; done
curl -s -o /dev/null -w "server /api/v1/threads   -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/api/v1/threads"
curl -s -o /dev/null -w "daemon /                 -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$DPORT/"
echo "--- starting 3 light API load loops (what an open browser tab / CLI does)"
for n in 1 2 3; do
  ( while :; do curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/threads"; curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/projects"; curl -s -o /dev/null --max-time 10 "http://127.0.0.1:$SPORT/api/v1/hosts"; sleep 0.1; done ) &
  LOADPIDS[$n]=$!
done
echo "--- starting memhog ($HOG MiB, hold ${HOLD}s) inside the same cgroup at $(date +%T)"
node "$(dirname "$0")/memhog.mjs" "$HOG" "$HOLD" > "$DATA/memhog.out" 2>&1 &
HOGPID=$!
sleep 10
for round in $(seq 1 14); do
  echo "=== $(date +%T) t+$((10 + (round-1)*10))s memory.current=$(cat $CG/memory.current) high=$(cat $CG/memory.high) swap.current=$(cat $CG/memory.swap.current)"
  echo "memory.events: $(tr '\n' ' ' < $CG/memory.events)"
  echo "memory.pressure: $(head -2 $CG/memory.pressure | tr '\n' ' ')"
  curl -s -o /dev/null -w "server  /health         -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/health" || echo "server  /health         -> TIMEOUT/ERR after 5s (curl exit $?)"
  curl -s -o /dev/null -w "server  /api/v1/threads -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$SPORT/api/v1/threads" || echo "server  /api/v1/threads -> TIMEOUT/ERR after 5s (curl exit $?)"
  curl -s -o /dev/null -w "daemon  /               -> %{http_code} in %{time_total}s\n" --max-time 5 "http://127.0.0.1:$DPORT/" || echo "daemon  /               -> TIMEOUT/ERR after 5s (curl exit $?)"
  dump_procs
  sleep 10
done
kill $HOGPID 2>/dev/null; wait $HOGPID 2>/dev/null
for n in 1 2 3; do kill ${LOADPIDS[$n]} 2>/dev/null; done
echo "--- $(date +%T) after hog exit"
sleep 5
echo "memory.current=$(cat $CG/memory.current) events: $(tr '\n' ' ' < $CG/memory.events)"
curl -s -o /dev/null -w "server  /health         -> %{http_code} in %{time_total}s\n" --max-time 10 "http://127.0.0.1:$SPORT/health" || echo "server /health still failing"
curl -s -o /dev/null -w "daemon  /               -> %{http_code} in %{time_total}s\n" --max-time 10 "http://127.0.0.1:$DPORT/" || echo "daemon / still failing"
kill -INT $LAUNCHER; wait $LAUNCHER
echo "launcher exited"
