#!/bin/bash
# Experiment H (issue #1706): REAL server restart mid-drain (no sqlite simulation).
# Queue a message on an active thread, then poll SQLite and kill -9 the bb server
# process the instant the drain worker has claimed the row (claimed_at set, row
# not yet consumed). The dev supervisor restarts the server. Show that after the
# restart the row is still stored but claimed, hidden from `bb thread queue list`,
# absent from `bb thread log`, and only released by the 5-minute stale-claim sweep.
#
# Usage:
#   BB_REPO=<bb worktree root> SERVER_PID=<pid of the server node process> ./1706-expH.sh <thread id>
# Find SERVER_PID with:  pgrep -af "tsx src/index.ts"   (the one whose /proc/<pid>/cwd is
#   <BB_REPO>/apps/server; check with `readlink /proc/<pid>/cwd`).
# Optional env: BB (CLI wrapper, default 1706-bb.sh next to this script), DB (bb.db path).
set -u
T="${1:?usage: BB_REPO=<worktree> SERVER_PID=<pid> $0 <thread id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="${BB:-$HERE/1706-bb.sh}"
export BB_REPO="${BB_REPO:?set BB_REPO to your bb worktree root}"
SERVER_PID="${SERVER_PID:?set SERVER_PID to the server node process pid}"
if [ -z "${DB:-}" ]; then
  DB="$("$BB_REPO/scripts/bb-dev-app" status 2>/dev/null | sed -n 's/^Data dir: //p')/bb.db"
fi
[ -f "$DB" ] || { echo "bb.db not found at $DB (set DB=...)" >&2; exit 2; }
[ "$(readlink /proc/$SERVER_PID/cwd)" = "$BB_REPO/apps/server" ] || { echo "pid $SERVER_PID is not the server of $BB_REPO" >&2; exit 2; }
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
echo "--- using thread=$T db=$DB server_pid=$SERVER_PID"
until $BB thread show $T --json | grep -q '"status": "idle"'; do sleep 2; done
$BB thread tell $T "Run the shell command 'sleep 30' and then reply only with ok." --mode steer
sleep 6
echo "--- target status:"; $BB thread show $T --json | grep '"status"' | head -1
$BB thread tell $T "MARKER_H_RESTART reply only with ok" --mode queue
echo "--- queue list (unclaimed row visible):"; $BB thread queue list $T | grep '"text"'
echo "--- polling sqlite for claimed_at (drain worker picks the row up when the turn ends) ..."
n=0
while :; do
  c=$(sqlite3 "$DB" "SELECT count(*) FROM queued_thread_messages WHERE thread_id='$T' AND claimed_at IS NOT NULL;")
  if [ "$c" != "0" ]; then kill -9 "$SERVER_PID"; echo "--- $(date -u +%T.%N | cut -c1-12) row claimed -> kill -9 $SERVER_PID (server)"; break; fi
  left=$(sqlite3 "$DB" "SELECT count(*) FROM queued_thread_messages WHERE thread_id='$T';")
  if [ "$left" = "0" ]; then echo "--- row consumed before we saw the claim; rerun"; exit 1; fi
  n=$((n+1)); [ $n -gt 6000 ] && { echo "--- timeout"; exit 1; }
  sleep 0.02
done
echo "--- sqlite right after kill:"; sqlite3 "$DB" "SELECT id, claimed_at, claim_token, substr(content,1,50) FROM queued_thread_messages WHERE thread_id='$T';"
echo "--- waiting for the dev supervisor to restart the server ..."
until curl -sf "$BB_SERVER_URL/api/v1/threads/$T" >/dev/null 2>&1; do sleep 1; done
echo "--- server back at $(date -u +%T)"
sleep 3
echo "--- target status:"; $BB thread show $T --json | grep '"status"' | head -1
echo "--- bb thread queue list:"; $BB thread queue list $T
echo "--- bb thread log | grep -c MARKER_H:"; $BB thread log $T | grep -c MARKER_H
echo "--- sqlite:"; sqlite3 "$DB" "SELECT id, claimed_at, claim_token FROM queued_thread_messages WHERE thread_id='$T';"
echo "--- now wait ~5 min for the stale-claim sweep, then run:  $BB thread log $T | tail -6"
