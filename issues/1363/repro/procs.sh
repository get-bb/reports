#!/bin/bash
# Usage: (cd <bb worktree> && bash procs.sh)
# Snapshot every descendant of THIS worktree's host daemon with pid/ppid/rss/etime/args.
source "$(dirname "$0")/env.sh" || exit 1
# The dev daemon is `tsx apps/host-daemon/src/index.ts` whose cwd is the worktree.
DAEMON=""
for p in $(pgrep -f "host-daemon/src/index.ts"); do
  cwd=$(readlink /proc/$p/cwd 2>/dev/null)
  if [ "$cwd" = "$WT" ] || [ "$cwd" = "$WT/apps/host-daemon" ]; then DAEMON=$p; break; fi
done
if [ -z "$DAEMON" ]; then echo "no host daemon found for $WT (is the dev instance running?)" >&2; exit 1; fi
echo "daemon pid: $DAEMON  ($(date -u +%H:%M:%S))"
descendants() {
  local parent=$1
  for c in $(pgrep -P $parent); do
    echo $c
    descendants $c
  done
}
PIDS=$(descendants $DAEMON)
printf "%-8s %-8s %-9s %-12s %s\n" PID PPID RSS_KB ETIME ARGS
for p in $PIDS; do
  ps -o pid=,ppid=,rss=,etime=,args= -p $p 2>/dev/null | awk '{pid=$1;ppid=$2;rss=$3;et=$4;$1=$2=$3=$4="";sub(/^ +/,"");a=$0; if (a ~ /bridge-worker-entry/) { match(a,/provider-[a-z-]+ /); a="[bridge] " substr(a,RSTART,RLENGTH)} else if (length(a)>90) a=substr(a,1,90)"..."; printf "%-8s %-8s %-9s %-12s %s\n",pid,ppid,rss,et,a}'
done
echo "--- counts:"
echo "bridges:      $(for p in $PIDS; do cat /proc/$p/cmdline 2>/dev/null | tr '\0' ' '; echo; done | grep -c bridge-worker-entry)"
echo "codex app-server: $(for p in $PIDS; do cat /proc/$p/cmdline 2>/dev/null | tr '\0' ' '; echo; done | grep -c 'codex app-server')"
echo "claude:       $(for p in $PIDS; do cat /proc/$p/cmdline 2>/dev/null | tr '\0' ' '; echo; done | grep -c 'claude ')"
