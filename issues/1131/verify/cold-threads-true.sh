#!/usr/bin/env bash
# Verifier: measure GET /api/v1/threads on the very first request after a
# fresh server start with the page cache evicted BEFORE the start.
set -u
REPO=/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-7
DB=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_6b6686dc-4c2-7-34ff9ca60a27/bb.db
cd "$REPO"
python3 /tmp/bb-reports/issues/1131/repro/1131-evict-cache.py "$DB"
scripts/bb-dev-app current 2>&1 | grep -E 'Server:'
for i in $(seq 1 200); do curl -sf -o /dev/null http://localhost:26014/health && echo up && break; sleep 0.5; done
P=$( (for p in $(pgrep -f "tsx src/index.ts"); do [ "$(readlink /proc/$p/cwd)" = "$REPO/apps/server" ] && echo $p; done; true) | head -1)
echo "pid=$P"; grep read_bytes /proc/$P/io
curl -s -o /dev/null -w "threads: http=%{http_code} ttfb=%{time_starttransfer}s size=%{size_download}\n" http://localhost:26014/api/v1/threads
grep read_bytes /proc/$P/io
