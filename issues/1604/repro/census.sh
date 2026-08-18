#!/usr/bin/env bash
# Linux only (reads /proc). Lists every process whose environment carries
# BB_THREAD_ID (i.e. an agent process spawned by the bb host daemon for a
# thread), with RSS in MB. Processes you cannot read are skipped silently.
# On macOS use instead:  ps -eo pid,etime,rss,command | grep -E 'claude|codex app-server' | grep -v grep
#                        and `ps eww -o command -p <pid> | tr ' ' '\n' | grep BB_THREAD_ID` to map pid -> thread.
# Usage: census.sh [thread-id-substring ...]
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
  envf=/proc/$pid/environ
  [ -r "$envf" ] || continue
  tid=$(tr '\0' '\n' < "$envf" 2>/dev/null | grep '^BB_THREAD_ID=' | cut -d= -f2)
  [ -n "$tid" ] || continue
  if [ $# -gt 0 ]; then
    match=0; for want in "$@"; do case "$tid" in *"$want"*) match=1;; esac; done
    [ $match = 1 ] || continue
  fi
  rss_kb=$(awk '/VmRSS/{print $2}' /proc/$pid/status 2>/dev/null)
  cmd=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null | cut -c1-90)
  printf '%-8s %-16s %6s MB  %s\n' "$pid" "$tid" "$((rss_kb/1024))" "$cmd"
done 2>/dev/null
