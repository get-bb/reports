#!/usr/bin/env bash
# Simulates an oversubscribed / slow vCPU: pins the vitest process to one core
# and shares that core with N busy loops (N=3 => ~25% CPU share for the test).
# Linux only: needs `taskset` (util-linux). Usage: run-contended.sh <worktree-root> <out-file>
# Env: CORE (default 3) picks the core; LOOPS (default 3) picks the number of busy loops.
# The failing assertion (full 1500-event window p50 <= 100 ms) trips once the
# throttled per-event cost exceeds ~0.067 ms/event; on a fast CPU with only 3
# loops it may still pass — raise LOOPS for more margin.
set -u
ROOT="$1"
OUT="$2"
CORE="${CORE:-3}"
LOOPS="${LOOPS:-3}"
command -v taskset >/dev/null || { echo "taskset not found (Linux util-linux required)"; exit 2; }
rm -f "$OUT"
pids=()
for i in $(seq 1 "$LOOPS"); do
  taskset -c "$CORE" node -e 'const e=Date.now()+240000; while(Date.now()<e){}' &
  pids+=($!)
done
sleep 1
cd "$ROOT/apps/server"
REPRO_1749_OUT="$OUT" taskset -c "$CORE" timeout 600 pnpm exec vitest run \
  test/services/threads/timeline-event-budget-cost.repro.test.ts 2>&1 \
  | sed 's/\x1b\[[0-9;]*m//g' | grep -v '^\s*$' | grep -E 'Tests|Duration|AssertionError|expected|✓|×|FAIL'
kill "${pids[@]}" 2>/dev/null
wait 2>/dev/null
echo "---- captured output ----"
cat "$OUT"
