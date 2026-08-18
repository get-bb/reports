#!/usr/bin/env bash
# Print every process in the bb1334 scope cgroup with RSS and command, plus memory stats.
CG=/sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/${1:-bb1334}.scope
echo "== cgroup: $CG"
printf '%-8s %-9s %s\n' PID RSS_KB CMD
while read -r p; do
  [ -r /proc/$p/cmdline ] || continue
  printf '%-8s %-9s %s\n' "$p" "$(ps -o rss= -p "$p" | tr -d ' ')" "$(tr '\0' ' ' < /proc/$p/cmdline | cut -c1-140)"
done < "$CG/cgroup.procs"
echo
echo "memory.current: $(cat $CG/memory.current) ($(( $(cat $CG/memory.current) / 1048576 )) MiB)"
echo "memory.high:    $(cat $CG/memory.high)"
echo "memory.max:     $(cat $CG/memory.max)"
echo "memory.swap.current: $(cat $CG/memory.swap.current 2>/dev/null)"
echo "memory.events:"; sed 's/^/  /' $CG/memory.events
echo "memory.pressure:"; sed 's/^/  /' $CG/memory.pressure
