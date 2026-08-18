#!/usr/bin/env bash
# Usage: find-worktree-procs.sh <path-prefix>
# Lists every process whose cwd is inside <path-prefix> (Linux /proc). A
# "(deleted)" suffix means the directory no longer exists on disk.
# pgid/sid are printed so you can see whether a process-group kill on the
# provider bridge could reach it (it cannot when pgid/sid differ from the bridge's).
prefix="$1"
for p in /proc/[0-9]*; do
  cwd=$(readlink "$p/cwd" 2>/dev/null) || continue
  case "$cwd" in
    "$prefix"*)
      pid="${p#/proc/}"
      ppid=$(awk '/^PPid:/{print $2}' "$p/status")
      read -r pgid sid < <(ps -o pgid=,sid= -p "$pid")
      cmd=$(tr '\0' ' ' < "$p/cmdline" | head -c 100)
      printf 'pid=%s ppid=%s pgid=%s sid=%s cwd=%s cmd=%s\n' "$pid" "$ppid" "$pgid" "$sid" "$cwd" "$cmd"
      ;;
  esac
done
