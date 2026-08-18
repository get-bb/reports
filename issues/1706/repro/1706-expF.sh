#!/bin/bash
# Experiment F (issue #1706): a queued row that is *claimed* (in-flight drain, or
# orphaned by a server restart mid-drain) is invisible to `bb thread queue list`
# and absent from `bb thread log`, although it is durably stored in SQLite.
#
# Usage:
#   BB_REPO=<your bb worktree root> ./1706-expF.sh <target thread id>
# Optional env:
#   BB   CLI wrapper (default: 1706-bb.sh next to this script)
#   DB   path to the dev instance's bb.db (default: "<Data dir printed by
#        scripts/bb-dev-app status>/bb.db", discovered automatically)
# Requires: sqlite3, a running dev instance (scripts/bb-dev-app current) and an
# idle codex thread created with
#   bb thread spawn --project <id> --provider codex --permission-mode accept-edits --prompt "Reply only with ok."
set -u
T="${1:?usage: BB_REPO=<worktree> $0 <thread id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="${BB:-$HERE/1706-bb.sh}"
export BB_REPO="${BB_REPO:?set BB_REPO to your bb worktree root}"
if [ -z "${DB:-}" ]; then
  DB="$("$BB_REPO/scripts/bb-dev-app" status 2>/dev/null | sed -n 's/^Data dir: //p')/bb.db"
fi
[ -f "$DB" ] || { echo "bb.db not found at $DB (set DB=...)" >&2; exit 2; }
echo "--- using thread=$T db=$DB"
until $BB thread show $T --json | grep -q '"status": "idle"'; do sleep 2; done
$BB thread tell $T "Run the shell command 'sleep 45' and then reply only with ok." --mode steer
sleep 6
echo "--- target status:"; $BB thread show $T --json | grep '"status"' | head -1
$BB thread tell $T "MARKER_F_CLAIMED reply only with ok" --mode queue
echo "--- queue list (unclaimed row visible):"; $BB thread queue list $T | grep '"text"'
# Simulate the drain worker having claimed the row (what happens for the whole
# duration of an in-flight send, or after a server restart mid-drain):
sqlite3 "$DB" "UPDATE queued_thread_messages SET claimed_at = $(date +%s000), claim_token = 'tok_simulated' WHERE thread_id = '$T';"
echo "--- sqlite row still present:"; sqlite3 "$DB" "SELECT id, claimed_at IS NOT NULL AS claimed, substr(content,1,60) FROM queued_thread_messages WHERE thread_id='$T';"
echo "--- bb thread queue list:"; $BB thread queue list $T
echo "--- bb thread log | grep MARKER_F:"; $BB thread log $T | grep -c MARKER_F
until $BB thread show $T --json | grep -q '"status": "idle"'; do sleep 3; done
echo "--- target idle now ($(date -u +%H:%M:%S)); queue list:"; $BB thread queue list $T
echo "--- log grep MARKER_F:"; $BB thread log $T | grep -c MARKER_F
echo "--- sqlite:"; sqlite3 "$DB" "SELECT id, claimed_at, claim_token FROM queued_thread_messages WHERE thread_id='$T';"
echo "--- now wait ~5 min for the stale-claim sweep, then run:  $BB thread log $T | tail -6"
