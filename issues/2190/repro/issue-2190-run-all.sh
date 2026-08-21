#!/usr/bin/env bash
# Runs the #2190 repro scripts from packages/db and stores outputs under /tmp/bb-reports/issues/2190/repro/.
set -u
export _ZO_DOCTOR=0
cd "$(dirname "$0")/.." || exit 1
OUT=/tmp/bb-reports/issues/2190/repro
what="${1:-all}"
if [ "$what" = all ] || [ "$what" = walk ]; then
  pnpm exec tsx test/issue-2190-walkthrough.ts > "$OUT/walkthrough-output.txt" 2>&1; echo "walkthrough exit=$?"
fi
if [ "$what" = all ] || [ "$what" = pin ]; then
  pnpm exec tsx test/issue-2190-pinned-reader.ts > "$OUT/pinned-reader-output.txt" 2>&1; echo "pinned exit=$?"
fi
if [ "$what" = all ] || [ "$what" = exit ]; then
  pnpm exec tsx test/issue-2190-exit-durability.ts > "$OUT/exit-durability-output.txt" 2>&1; echo "exit-durability exit=$?"
fi
if [ "$what" = all ] || [ "$what" = vitest ]; then
  pnpm exec vitest run test/issue-2190-wal-revert.test.ts > "$OUT/vitest-final.txt" 2>&1; echo "vitest exit=$?"
fi
