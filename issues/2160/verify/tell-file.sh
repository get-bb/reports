#!/bin/zsh
# Usage: tell-file.sh <thread-id> <model> <file>
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-9 || exit 1
eval "$(scripts/bb-dev-app env)"
MSG="$(cat "$3")"
pnpm bb:dev thread tell "$1" --model "$2" --mode auto --json "$MSG" 2>&1 | tail -3
