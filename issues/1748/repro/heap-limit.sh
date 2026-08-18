#!/usr/bin/env bash
# Issue #1748 experiment 1: what does V8 pick as the heap limit, and does a cgroup limit change it?
# Usage: ./heap-limit.sh   (needs node; systemd-run is optional for the cgroup step)
set -u
echo "node: $(node --version)"
echo "physical RAM (MiB): $(node -p 'Math.round(require("os").totalmem()/1048576)')"
show='const v8=require("v8");const s=v8.getHeapStatistics();console.log("heap_size_limit MiB =", Math.round(s.heap_size_limit/1048576), " execArgv=", JSON.stringify(process.execArgv), " NODE_OPTIONS=", process.env.NODE_OPTIONS ?? "(unset)")'
echo "--- default:"; node -e "$show"
echo "--- --max-old-space-size=512 flag:"; node --max-old-space-size=512 -e "$show"
echo "--- NODE_OPTIONS=--max-old-space-size=512:"; NODE_OPTIONS=--max-old-space-size=512 node -e "$show"
if command -v systemd-run >/dev/null; then
  echo "--- inside a cgroup with MemoryMax=512M MemoryHigh=400M (systemd-run --user --scope):"
  systemd-run --user --scope -q -p MemoryMax=512M -p MemoryHigh=400M bash -c "echo memory.max=\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.max) memory.high=\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.high); node -e '$show'" 2>&1
fi
echo "--- a child spawned with spawn(process.execPath,[script]) (what bb-app does for the server) does NOT inherit the parent's execArgv ..."
cat > /tmp/1748-child.cjs <<'JS'
const v8=require("v8");
console.log("  child heap_size_limit MiB =", Math.round(v8.getHeapStatistics().heap_size_limit/1048576), "execArgv=", JSON.stringify(process.execArgv), "NODE_OPTIONS=", process.env.NODE_OPTIONS ?? "(unset)");
JS
node --max-old-space-size=300 -e 'const {spawnSync}=require("child_process");console.log("  parent execArgv=",JSON.stringify(process.execArgv));const r=spawnSync(process.execPath,["/tmp/1748-child.cjs"],{encoding:"utf8"});process.stdout.write(r.stdout)'
echo "--- ... but DOES inherit NODE_OPTIONS:"
NODE_OPTIONS=--max-old-space-size=300 node -e 'const {spawnSync}=require("child_process");const r=spawnSync(process.execPath,["/tmp/1748-child.cjs"],{encoding:"utf8"});process.stdout.write(r.stdout)'
