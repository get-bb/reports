#!/usr/bin/env bash
set -euo pipefail
export BB_SERVER_URL=http://localhost:24052 BB_HOST_DAEMON_PORT=32052 BB_PROJECT_ID=proj_t4qbxr2qqk
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-75
node packages/scripts/dist/commands/run-cli.js thread spawn --json \
  --project proj_t4qbxr2qqk --environment /tmp/bb-1751-verify-repo --machine host_riqgazfrts \
  --provider claude-code --permission-mode full --title "verify-1751" \
  --prompt "$(cat /tmp/bb-reports/issues/1751/repro/prompt.md)"
