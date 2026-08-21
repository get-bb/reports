#!/usr/bin/env bash
# Full live measurement for one branch: fresh server, warm fetches, GC'd heap
# baseline, N append+fetch rounds, GC'd heap afterwards.
# Usage: measure.sh <label> <rounds>
set -euo pipefail
LABEL=$1; ROUNDS=$2
HERE=/tmp/bb-reports/issues/2066/verify
WT=/Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-21
DB=/Users/sawyerhood/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-21-5859a8374496/bb.db
SERVER=http://localhost:25775
THREAD=thr_6zik7e8uvr; ENV_ID=env_866bjs4xjm; PTID=8e22443c-a63a-724c-e6a1-7e51fdbc2789

cd "$WT"
pnpm dev:stop >/dev/null 2>&1 || true
sleep 3
sqlite3 "$DB" "delete from events where id like 'evt_repro_%';"
scripts/bb-dev-app current >"$HERE/dev-start-$LABEL.log" 2>&1
for i in $(seq 1 60); do curl -s -m 3 -o /dev/null -f "$SERVER/api/v1/projects" && break; sleep 1; done
PID=$(lsof -nP -iTCP:25775 -sTCP:LISTEN -t | head -1)
echo "branch=$(git rev-parse --short HEAD) pid=$PID"
for i in 1 2 3; do curl -s -m 30 -o /dev/null "$SERVER/api/v1/threads/$THREAD/timeline"; done
node /tmp/bb-reports/issues/2066/repro/heap-after-gc.mjs "$PID" "$LABEL: before loop (warm, 1 cached revision)"
/tmp/bb-reports/issues/2066/repro/live-loop.sh "$SERVER" "$DB" "$THREAD" "$ENV_ID" "$PTID" "$ROUNDS" "$HERE/live-$LABEL.csv"
node /tmp/bb-reports/issues/2066/repro/heap-after-gc.mjs "$PID" "$LABEL: after $ROUNDS append+fetch rounds"
