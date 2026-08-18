#!/usr/bin/env bash
# Issue #1131: the ORIGINAL report was a cold `bb thread list --json` stalling
# the loop for 11.2 s. Measure that path cold on this build (after #1204).
# Usage: BB_REPO=/abs/path/to/bb ./1131-cold-thread-list.sh
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
DATA_DIR=${DATA_DIR:-$("$BB_REPO/scripts/bb-dev-app" status | sed -n 's/^Data dir: //p')}
DB=${DB:-$DATA_DIR/bb.db}
HERE=$(cd "$(dirname "$0")" && pwd)
SERVER_PID=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$BB_REPO/apps/server" ] && echo $p; done; true) | head -1)
echo "--- kill -9 server pid $SERVER_PID, wait for supervisor restart"
kill -9 "$SERVER_PID"
for i in $(seq 1 120); do sleep 0.5; curl -sf -o /dev/null "$BB_SERVER_URL/health" && break; done
sleep 3
python3 "$HERE/1131-evict-cache.py" "$DB"
NEW_PID=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$BB_REPO/apps/server" ] && echo $p; done; true) | head -1)
IO_BEFORE=$(grep -E "^read_bytes" /proc/$NEW_PID/io)
echo "--- $(date +%T.%N | cut -c1-12) GET /api/v1/threads (cold, first after restart)"
curl -s -o /tmp/1131-threads.json -w "threads: http=%{http_code} ttfb=%{time_starttransfer}s size=%{size_download}\n" "$BB_SERVER_URL/api/v1/threads"
IO_AFTER=$(grep -E "^read_bytes" /proc/$NEW_PID/io)
echo "--- server io before: $IO_BEFORE / after: $IO_AFTER"
python3 -c "import json;d=json.load(open('/tmp/1131-threads.json'));print('thread rows returned:', len(d if isinstance(d,list) else d.get('threads',d)))" || true
echo "--- $(date +%T.%N | cut -c1-12) second GET /api/v1/threads (warm)"
curl -s -o /dev/null -w "threads: http=%{http_code} ttfb=%{time_starttransfer}s\n" "$BB_SERVER_URL/api/v1/threads"
echo "--- bb thread list --json (warm) via CLI"
cd "$BB_REPO" && time (pnpm bb:dev thread list --json >/dev/null)
LOG=$(ls -t "$HOME/.bb-dev/launchers/"*"$(basename "$BB_REPO")"*/dev.log 2>/dev/null | head -1)
grep -a "Event loop stalled\|Slow DB query\|slow request" "$LOG" | tail -3 | cut -c1-600 || true
