#!/usr/bin/env bash
# Issue #1131 (control, truly cold): the original report was a cold
# `bb thread list --json` stalling the loop 11.2 s (fixed by #1204). This
# measures GET /api/v1/threads on the very first request after a fresh
# server start whose page cache was evicted BEFORE the start, and reports
# how many bytes server startup itself faulted in versus the request.
# NOTE: 1131-cold-thread-list.sh (kill -9 + evict + request) is effectively
# warm for this route: the restarted server touches the threads pages during
# startup, and posix_fadvise(DONTNEED) cannot evict pages a live process holds.
# Usage (dev instance STOPPED first: `pnpm dev:stop`):
#   BB_REPO=/abs/path/to/bb ./1131-cold-thread-list-true.sh
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$BB_REPO"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
DATA_DIR=$("$BB_REPO/scripts/bb-dev-app" status | sed -n 's/^Data dir: //p')
DB=$DATA_DIR/bb.db
if curl -sf -o /dev/null "$BB_SERVER_URL/health"; then echo "server is running; run pnpm dev:stop first" >&2; exit 1; fi
python3 "$HERE/1131-evict-cache.py" "$DB"
echo "--- $(date +%T.%N | cut -c1-12) starting dev instance"
scripts/bb-dev-app current 2>&1 | grep -E '^Server:'
for i in $(seq 1 240); do curl -sf -o /dev/null "$BB_SERVER_URL/health" && break; sleep 0.5; done
PID=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$BB_REPO/apps/server" ] && echo $p; done; true) | head -1)
echo "--- $(date +%T.%N | cut -c1-12) server up, pid $PID; startup so far: $(grep read_bytes /proc/$PID/io)"
echo "--- $(date +%T.%N | cut -c1-12) GET /api/v1/threads (first request after a cold start; before the first sweep tick at +10 s)"
curl -s -o /tmp/1131-threads.json -w "threads: http=%{http_code} ttfb=%{time_starttransfer}s size=%{size_download}\n" "$BB_SERVER_URL/api/v1/threads"
echo "--- after request: $(grep read_bytes /proc/$PID/io)"
python3 -c "import json;d=json.load(open('/tmp/1131-threads.json'));print('thread rows returned:', len(d if isinstance(d,list) else d.get('threads',d)))" || true
echo "--- $(date +%T.%N | cut -c1-12) second GET /api/v1/threads (warm)"
curl -s -o /dev/null -w "threads: http=%{http_code} ttfb=%{time_starttransfer}s\n" "$BB_SERVER_URL/api/v1/threads"
