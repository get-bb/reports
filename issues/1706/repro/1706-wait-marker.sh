#!/bin/bash
# Poll `bb thread log <thread>` until <marker> appears (max ~7 min), then print
# the queue list, the sqlite row state and the log tail.
# Usage: BB_REPO=<worktree> ./1706-wait-marker.sh <thread id> <marker>
set -u
T="${1:?thread id}"; M="${2:?marker}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="${BB:-$HERE/1706-bb.sh}"
export BB_REPO="${BB_REPO:?set BB_REPO}"
DB="${DB:-$("$BB_REPO/scripts/bb-dev-app" status 2>/dev/null | sed -n 's/^Data dir: //p')/bb.db}"
for i in $(seq 1 84); do
  if [ "$($BB thread log "$T" | grep -c "$M")" != "0" ]; then break; fi
  sleep 5
done
date -u
echo "--- queue list:"; $BB thread queue list "$T"
echo "--- sqlite:"; sqlite3 "$DB" "SELECT id, claimed_at, claim_token FROM queued_thread_messages WHERE thread_id='$T';"
echo "--- log tail:"; $BB thread log "$T" | tail -6
