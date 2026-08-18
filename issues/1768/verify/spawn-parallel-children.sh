#!/usr/bin/env bash
# Spawn two bad-model children of $PARENT in parallel so they fail within the 2 s batch window.
set -u
CLI="node /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-10/packages/scripts/dist/commands/run-cli.js"
export BB_THREAD_ID="$PARENT"
cd "$(dirname "$0")"
for n in 3 4; do
  $CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
    --parent-self --title "1768 batch child $n" --model does-not-exist-model \
    --prompt "Reply only with ok." --json > "08b-parallel-child-$n.json" 2>&1 &
done
wait
grep -h '"id"' 08b-parallel-child-*.json
