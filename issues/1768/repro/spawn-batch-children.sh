#!/usr/bin/env bash
# Spawns two children of $PARENT IN PARALLEL with a nonexistent model so both
# fail inside the 2 s child-notification batch window
# (CHILD_THREAD_TURN_NOTIFICATION_BATCH_DELAY_MS = 2000 in
# apps/server/src/services/threads/child-thread-notifications.ts) and the parent
# receives ONE "[bb system] Child thread updates:" message.
#
# NOTE: batching is timing-dependent. Spawning the two children sequentially
# (each `bb thread spawn` takes several seconds) usually yields two separate
# single-child "@thread:X failed." messages instead. Verify with
#   bb thread log $PARENT --json --limit 100000 | grep -c 'Child thread updates'
# and re-run this script if that prints 0.
#
# Usage (from the bb repo root, after `eval "$(scripts/bb-dev-app env)"`):
#   PARENT=thr_xxx PROJECT=proj_xxx bash spawn-batch-children.sh
# CLI overrides the CLI command (default: node packages/scripts/dist/commands/run-cli.js,
# relative to the current directory, i.e. the repo root). OUT_DIR is where the
# spawn JSON is written (default: this script's directory).
set -u
CLI="${CLI:-node packages/scripts/dist/commands/run-cli.js}"
OUT="${OUT_DIR:-$(cd "$(dirname "$0")" && pwd)}"
export BB_THREAD_ID="$PARENT"
for n in 1 2; do
  $CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
    --parent-self --title "1768 batch child $n" --model does-not-exist-model \
    --prompt "Reply only with ok." --json > "$OUT/08-batch-child-$n.json" 2>&1 &
done
wait
grep -h -E '"id"|"parentThreadId"' "$OUT"/08-batch-child-*.json
