#!/usr/bin/env bash
# Print the inotify watch count + RSS of the bb host-daemon watcher child for a
# given worktree/bundle path fragment. Works for the dev (tsx) child
# (parcel-child-entry.ts) and the packaged child (bb-parcel-watcher-child.mjs).
#   usage: watcher-child-stats.sh <path fragment that identifies YOUR daemon>
FRAG="${1:?path fragment}"
for pid in $(pgrep -f "parcel-child-entry.ts|bb-parcel-watcher-child.mjs"); do
  cmd=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null)
  case "$cmd" in *"$FRAG"*) ;; *) continue ;; esac
  watches=$(cat /proc/$pid/fdinfo/* 2>/dev/null | grep -c '^inotify wd:')
  rss_kb=$(awk '/VmRSS/ {print $2}' /proc/$pid/status)
  echo "pid=$pid inotify_watches=$watches rss_mb=$((rss_kb/1024)) cmd=$cmd"
done
