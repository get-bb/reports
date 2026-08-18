#!/usr/bin/env bash
# Issue #1131 repro: one cold timeline build for a 44k-event thread blocks the
# server event loop; an unrelated cheap request (GET /health) stalls meanwhile.
#
# Usage: BB_REPO=/abs/path/to/bb/worktree ./1131-cold-timeline.sh <thread id>
# Requires: the dev instance of $BB_REPO running (scripts/bb-dev-app current),
#           python3, curl.  Set BB_SERVER_URL / DB to override discovery.
set -euo pipefail
THREAD=${1:?thread id}
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
DATA_DIR=${DATA_DIR:-$("$BB_REPO/scripts/bb-dev-app" status | sed -n 's/^Data dir: //p')}
DB=${DB:-$DATA_DIR/bb.db}
echo "--- server=$BB_SERVER_URL db=$DB thread=$THREAD"

# 1. restart the server process so its in-memory timeline cache + SQLite page
#    cache are empty (the dev supervisor restarts it within ~1 s).
SERVER_PID=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$BB_REPO/apps/server" ] && echo $p; done; true) | head -1)
echo "--- kill -9 server pid $SERVER_PID"
kill -9 "$SERVER_PID"
for i in $(seq 1 120); do
  sleep 0.5
  curl -sf -o /dev/null "$BB_SERVER_URL/health" && break
done
sleep 3
echo "--- server back"

# 2. evict the OS page cache for the database files (no root needed).
python3 - "$DB" <<'PY'
import os, sys
for suffix in ("", "-wal", "-shm"):
    p = sys.argv[1] + suffix
    if not os.path.exists(p):
        continue
    fd = os.open(p, os.O_RDONLY)
    os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
    os.close(fd)
    print("evicted", p, os.path.getsize(p))
PY

# 3. probe: GET /health every 100 ms in the background, log TTFB.
PROBE=$(mktemp)
( for i in $(seq 1 80); do
    curl -s -o /dev/null -w "$(date +%H:%M:%S.%N | cut -c1-12) health ttfb=%{time_starttransfer}s\n" "$BB_SERVER_URL/health"
    sleep 0.1
  done ) > "$PROBE" &
PROBE_PID=$!
sleep 0.5

# 4. the cold timeline request; also count the server's disk reads for it.
NEW_PID=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$BB_REPO/apps/server" ] && echo $p; done; true) | head -1)
IO_BEFORE=$(grep -E "^(rchar|syscr|read_bytes)" /proc/$NEW_PID/io | tr '\n' ' ')
echo "--- $(date +%H:%M:%S.%N | cut -c1-12) GET /api/v1/threads/$THREAD/timeline (cold)"
curl -s -o /dev/null -w "timeline: http=%{http_code} ttfb=%{time_starttransfer}s size=%{size_download}\n" "$BB_SERVER_URL/api/v1/threads/$THREAD/timeline"
IO_AFTER=$(grep -E "^(rchar|syscr|read_bytes)" /proc/$NEW_PID/io | tr '\n' ' ')
echo "--- server /proc/$NEW_PID/io before: $IO_BEFORE"
echo "--- server /proc/$NEW_PID/io after:  $IO_AFTER"
echo "--- $(date +%H:%M:%S.%N | cut -c1-12) second request (warm, cached)"
curl -s -o /dev/null -w "timeline: http=%{http_code} ttfb=%{time_starttransfer}s size=%{size_download}\n" "$BB_SERVER_URL/api/v1/threads/$THREAD/timeline"
wait $PROBE_PID
echo "--- /health probe, slowest 5:"
sort -t "=" -k2 -r "$PROBE" | head -5
echo "--- /health probe, all samples > 0.05s:"
awk -F'ttfb=' '{ v=$2; sub(/s$/,"",v); if (v+0 > 0.05) print }' "$PROBE"
rm -f "$PROBE"
echo "--- server log lines:"
LOG=$(ls -t "$HOME/.bb-dev/launchers/"*"$(basename "$BB_REPO")"*/dev.log 2>/dev/null | head -1)
grep -a "timeline build blocked\|Event loop stalled" "$LOG" | tail -3 | cut -c1-1500
