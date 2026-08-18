#!/usr/bin/env bash
# Issue #1748 experiment 2: V8's default heap_size_limit as a function of the cgroup memory.max
# the node process runs under (systemd-run --user --scope puts the command in a fresh cgroup with
# the given properties). Also checks whether MemoryHigh alone (no MemoryMax) is honored.
set -u
show='const v8=require("v8");const os=require("os");console.log("  totalmem MiB =",Math.round(os.totalmem()/1048576),"heap_size_limit MiB =",Math.round(v8.getHeapStatistics().heap_size_limit/1048576))'
echo "node $(node --version), host RAM $(node -p 'Math.round(require("os").totalmem()/1048576)') MiB"
echo "--- no cgroup limit (plain shell):"; node -e "$show"
for mm in 512M 1G 2G 3G 3800M 4G 5017M 8G 16G 32G; do
  echo "--- MemoryMax=$mm:"
  systemd-run --user --scope -q -p MemoryMax=$mm bash -c "echo '  memory.max='\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.max); node -e '$show'" 2>&1
done
echo "--- MemoryHigh=3G only (no MemoryMax), like the reporter's MemoryHigh:"
systemd-run --user --scope -q -p MemoryHigh=3G bash -c "echo '  memory.max='\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.max) 'memory.high='\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.high); node -e '$show'" 2>&1
echo "--- reporter's exact unit properties MemoryHigh=3G MemoryMax=3800M:"
systemd-run --user --scope -q -p MemoryHigh=3G -p MemoryMax=3800M bash -c "echo '  memory.max='\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.max) 'memory.high='\$(cat /sys/fs/cgroup\$(cut -d: -f3 /proc/self/cgroup)/memory.high); node -e '$show'" 2>&1
echo "--- MemoryMax on the PARENT cgroup only (child cgroup nested inside a limited scope): does node see it?"
systemd-run --user --scope -q -p MemoryMax=1G -p Delegate=yes bash -c 'me=/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup); mkdir -p $me/child 2>/dev/null && echo $$ > $me/child/cgroup.procs 2>/dev/null; echo "  own cgroup memory.max=$(cat /sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup)/memory.max) parent memory.max=$(cat $me/memory.max)"; node -e '"$show"'' 2>&1
