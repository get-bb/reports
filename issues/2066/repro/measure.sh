#!/usr/bin/env bash
# Full live measurement for one branch: fresh server, warm fetches, GC'd heap
# baseline, N append+fetch rounds, GC'd heap afterwards.
#
# Usage (run from inside the bb worktree whose branch you want to measure):
#   cd <your bb worktree> && /tmp/bb-reports/issues/2066/repro/measure.sh <label> <rounds>
#
# Nothing is hardcoded to a particular worktree: WT is the git toplevel of the
# current directory, and DB / SERVER come from `scripts/bb-dev-app status`
# (which derives ports and the data dir from the worktree path). Override any
# of WT, DB, SERVER, OUT_DIR via the environment if needed.
#
# Prerequisites (once per worktree):
#   pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
#   scripts/bb-dev-app current && pnpm dev:stop      # creates the data dir
#   pnpm seed:perf -- --projects 1 --threads 6 --events 30000 --seed 7
# The seed is deterministic, so THREAD / ENV_ID / PTID below are stable.
# heap-after-gc.mjs uses the inspector on 127.0.0.1:9229 (SIGUSR1 default);
# the script aborts if that port is already taken.
set -euo pipefail
LABEL=$1; ROUNDS=$2
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT_DIR=${OUT_DIR:-$HERE}
WT=${WT:-$(git rev-parse --show-toplevel)}
cd "$WT"
STATUS=$(scripts/bb-dev-app status)
DB=${DB:-$(printf '%s\n' "$STATUS" | sed -n 's/^Data dir: //p')/bb.db}
SERVER=${SERVER:-$(printf '%s\n' "$STATUS" | sed -n 's/^Server: //p')}
PORT=${SERVER##*:}
THREAD=thr_6zik7e8uvr; ENV_ID=env_866bjs4xjm; PTID=8e22443c-a63a-724c-e6a1-7e51fdbc2789

[ -f "$DB" ] || { echo "no db at $DB (run scripts/bb-dev-app current, pnpm dev:stop, pnpm seed:perf first)" >&2; exit 1; }
echo "worktree=$WT db=$DB server=$SERVER out=$OUT_DIR" >&2

pnpm dev:stop >/dev/null 2>&1 || true   # also releases 9229 if a previous run activated the inspector
sleep 3
if lsof -nP -iTCP:9229 -sTCP:LISTEN -t >/dev/null 2>&1; then echo "inspector port 9229 already in use by another process" >&2; exit 1; fi
sqlite3 "$DB" "delete from events where id like 'evt_repro_%';"
scripts/bb-dev-app current >"$OUT_DIR/dev-start-$LABEL.log" 2>&1
for i in $(seq 1 60); do curl -s -m 3 -o /dev/null -f "$SERVER/api/v1/projects" && break; sleep 1; done
PID=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -1)
echo "branch=$(git rev-parse --short HEAD) pid=$PID"
for i in 1 2 3; do curl -s -m 30 -o /dev/null "$SERVER/api/v1/threads/$THREAD/timeline"; done
node "$HERE/heap-after-gc.mjs" "$PID" "$LABEL: before loop (warm, 1 cached revision)"
"$HERE/live-loop.sh" "$SERVER" "$DB" "$THREAD" "$ENV_ID" "$PTID" "$ROUNDS" "$OUT_DIR/live-$LABEL.csv"
node "$HERE/heap-after-gc.mjs" "$PID" "$LABEL: after $ROUNDS append+fetch rounds"
