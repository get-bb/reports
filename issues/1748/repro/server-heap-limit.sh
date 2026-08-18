#!/usr/bin/env bash
# Issue #1748 experiment 3: the REAL bb server (apps/server/dist/index.js, the file bb-app spawns)
# started under the reporter's exact systemd memory properties (MemoryHigh=3G, MemoryMax=3800M),
# then asked for a Node diagnostic report (SIGUSR2) whose javascriptHeap.memoryLimit is V8's
# heap_size_limit. Compared with the same server started with no cgroup limit, and inside a
# 5017M (= 4.9 GiB) cgroup, which is what a 4.9 GiB host with NO cgroup limit would produce.
# Usage: BB_REPO=<built bb worktree> ./server-heap-limit.sh
set -u
: "${BB_REPO:?set BB_REPO}"
cd "$BB_REPO"
run_case() {
  local label="$1"; shift
  local data=/tmp/1748-server-data-$label; rm -rf "$data"; mkdir -p "$data/report"
  echo "=== $label"
  BB_DATA_DIR="$data" BB_SERVER_PORT=41750 BB_HOST_DAEMON_PORT=41751 NODE_ENV=production \
    "$@" node --report-on-signal --report-signal=SIGUSR2 --report-directory="$data/report" \
    apps/server/dist/index.js > "$data/server.log" 2>&1 &
  local wrapper=$!
  for _ in $(seq 1 150); do
    sleep 0.2
    curl -sf http://127.0.0.1:41750/health >/dev/null 2>&1 && break
  done
  local pid
  pid=$(pgrep -f "report-directory=$data/report" | head -1)
  echo "  cgroup: $(cut -d: -f3 /proc/$pid/cgroup)  memory.max=$(cat /sys/fs/cgroup$(cut -d: -f3 /proc/$pid/cgroup)/memory.max) memory.high=$(cat /sys/fs/cgroup$(cut -d: -f3 /proc/$pid/cgroup)/memory.high)"
  kill -USR2 "$pid"; sleep 1.5
  local rep; rep=$(ls "$data"/report/*.json 2>/dev/null | head -1)
  node -e '
    const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
    const h=r.javascriptHeap; const mib=(n)=>Math.round(n/1048576);
    console.log("  node", r.header.nodejsVersion, "commandLine:", r.header.commandLine.slice(0,4).join(" "), "...");
    console.log("  javascriptHeap.memoryLimit (heap_size_limit) MiB =", mib(h.memoryLimit), " usedMemory MiB =", mib(h.usedMemory), " totalMemory MiB =", mib(h.totalMemory), " rss MiB =", mib(r.resourceUsage.rss ?? r.resourceUsage.maxRss*1024));
  ' "$rep"
  kill -TERM "$pid" "$wrapper" 2>/dev/null; wait "$wrapper" 2>/dev/null; sleep 0.5
}
run_case unconstrained env
run_case reporter-unit systemd-run --user --scope -q -p MemoryHigh=3G -p MemoryMax=3800M
run_case host-4.9GiB-no-cgroup systemd-run --user --scope -q -p MemoryMax=5017M
