#!/usr/bin/env bash
# Spawns two children of $PARENT back-to-back with a nonexistent model so both
# fail inside the 2 s child-notification batch window and the parent receives a
# single "[bb system] Child thread updates:" message.
# Usage: BB_SERVER_URL=... PARENT=thr_xxx PROJECT=proj_xxx bash spawn-batch-children.sh
set -u
CLI="node /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-10/packages/scripts/dist/commands/run-cli.js"
export BB_THREAD_ID="$PARENT"
for n in 1 2; do
  $CLI thread spawn --project "$PROJECT" --provider codex --permission-mode accept-edits \
    --parent-self --title "1768 batch child $n" --model does-not-exist-model \
    --prompt "Reply only with ok." --json 2>/dev/null | grep -E '"id"|"parentThreadId"' | head -2
done
