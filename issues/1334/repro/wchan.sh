#!/usr/bin/env bash
# Show the kernel wait channel (wchan) and state of every task in the bb1334 scope,
# to confirm they are parked in mem_cgroup_handle_over_high.
CG=/sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/${1:-bb1334}.scope
printf '%-8s %-3s %-32s %s\n' PID ST WCHAN COMM
while read -r p; do
  [ -r /proc/$p/stat ] || continue
  st=$(awk '{print $3}' /proc/$p/stat)
  wc=$(cat /proc/$p/wchan 2>/dev/null)
  comm=$(cat /proc/$p/comm)
  printf '%-8s %-3s %-32s %s\n' "$p" "$st" "$wc" "$comm"
  # threads
  for t in /proc/$p/task/*; do
    tid=${t##*/}; [ "$tid" = "$p" ] && continue
    twc=$(cat $t/wchan 2>/dev/null)
    case "$twc" in *over_high*|*reclaim*|*throttle*) printf '  tid %-6s %-3s %-32s %s\n' "$tid" "$(awk '{print $3}' $t/stat)" "$twc" "$(cat $t/comm)";; esac
  done
done < "$CG/cgroup.procs"
