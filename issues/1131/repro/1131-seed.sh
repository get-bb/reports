#!/usr/bin/env bash
# Issue #1131: build a bb.db at the reporter's scale in your dev data dir.
# Result on this machine: 1.57 GB file, 704k events (1.03 GiB of event JSON,
# 831 MB of it commandExecution item/completed), one 44k-event thread (70 MB).
#
# Usage: BB_REPO=/abs/path/to/bb ./1131-seed.sh
# Prereq: `scripts/bb-dev-app current` has been run once (creates the data
#         dir + host-id) and then `pnpm dev:stop`.
set -euo pipefail
: "${BB_REPO:?set BB_REPO}"
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$BB_REPO"
# Two env knobs added to packages/scripts/src/lib/seed-perf-fixture.ts (see
# 1131-seed-fixture.diff): one giant thread, and 6x longer command outputs so
# per-event bytes match production (~3 KB avg).
git apply --check "$HERE/1131-seed-fixture.diff" 2>/dev/null && git apply "$HERE/1131-seed-fixture.diff" || echo "(fixture diff already applied)"
pnpm exec turbo run build --filter=@bb/scripts >/dev/null
export BB_SEED_GIANT_THREAD_EVENTS=44000 BB_SEED_OUTPUT_LINE_SCALE=6
pnpm seed:perf -- --reset --threads 4000 --events 650000
DATA_DIR=$("$BB_REPO/scripts/bb-dev-app" status | sed -n 's/^Data dir: //p')
sqlite3 "$DATA_DIR/bb.db" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null
echo "--- giant thread:"
sqlite3 "$DATA_DIR/bb.db" "select thread_id, count(*) events, sum(length(data)) bytes from events group by thread_id order by 2 desc limit 1;"
ls -la "$DATA_DIR/bb.db"
