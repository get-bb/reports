#!/usr/bin/env bash
# run a bb CLI command against the verifier's dev instance
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-9 || exit 1
eval "$(scripts/bb-dev-app env)"
exec pnpm bb:dev "$@"
