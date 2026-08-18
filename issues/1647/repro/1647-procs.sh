#!/bin/bash
# List every process whose cwd is at or under $1 (Linux /proc). Prints pid, ppid, cwd, cmdline.
dir="$1"
for p in /proc/[0-9]*; do
  pid=${p#/proc/}
  cwd=$(readlink "$p/cwd" 2>/dev/null) || continue
  case "$cwd" in
    "$dir"|"$dir/"*|"$dir (deleted)"|"$dir/"*" (deleted)")
      ppid=$(awk '/^PPid:/{print $2}' "$p/status" 2>/dev/null)
      cmd=$(tr '\0' ' ' < "$p/cmdline" 2>/dev/null | cut -c1-110)
      printf '%s\tppid=%s\t%s\t%s\n' "$pid" "$ppid" "$cwd" "$cmd";;
  esac
done
