#!/usr/bin/env bash
# Run the per-statement timeline profiler (issue-1131-profile.ts) against a
# bb.db, cold (page cache evicted) then warm.
# Usage: BB_REPO=/abs/path/to/bb ./1131-profile.sh <bb.db> <thread id> [out-prefix]
set -euo pipefail
DB=${1:?bb.db path}; THREAD=${2:?thread id}; OUT=${3:-/tmp/1131-profile}
: "${BB_REPO:?set BB_REPO}"
HERE=$(cd "$(dirname "$0")" && pwd)
cp "$HERE/issue-1131-profile.ts" "$BB_REPO/apps/server/issue-1131-profile.ts"
cd "$BB_REPO/apps/server"
python3 "$HERE/1131-evict-cache.py" "$DB"
echo "=== COLD"
node --conditions=source --import tsx issue-1131-profile.ts "$DB" "$THREAD" | tee "$OUT-cold.out"
echo "=== WARM"
node --conditions=source --import tsx issue-1131-profile.ts "$DB" "$THREAD" | tee "$OUT-warm.out"
