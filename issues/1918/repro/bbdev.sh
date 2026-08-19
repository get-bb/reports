#!/usr/bin/env bash
# Run the bb CLI against THIS worktree's dev instance.
set -u
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-1 || exit 1
eval "$(scripts/bb-dev-app env)"
exec pnpm -s bb:dev "$@"
