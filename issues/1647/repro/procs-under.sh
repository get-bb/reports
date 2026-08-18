#!/usr/bin/env bash
# List every process whose cwd is at or under $1 (Linux /proc).
# A cwd whose directory was removed shows as "<path> (deleted)".
root="$1"
for p in /proc/[0-9]*; do
  c=$(readlink "$p/cwd" 2>/dev/null) || continue
  case "$c" in
    "$root"*)
      pid=$(basename "$p")
      ppid=$(awk '/^PPid/{print $2}' "$p/status")
      pgid=$(cut -d' ' -f5 "$p/stat")
      cmd=$(tr '\0' ' ' < "$p/cmdline" | cut -c1-110)
      echo "pid=$pid ppid=$ppid pgid=$pgid cwd=$c cmd=$cmd"
      ;;
  esac
done
