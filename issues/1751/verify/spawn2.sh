#!/usr/bin/env bash
set -euo pipefail
export BB_SERVER_URL=http://localhost:23936 BB_HOST_DAEMON_PORT=31936 BB_PROJECT_ID=proj_zc3nk34k2u
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
cd /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-11
node packages/scripts/dist/commands/run-cli.js thread spawn --json \
  --project proj_zc3nk34k2u --environment /tmp/bb-1751-v2-repo --machine host_5vfkj95x5y \
  --provider claude-code --permission-mode full --title "verify2-1751" \
  --prompt "$(cat /tmp/bb-reports/issues/1751/repro/prompt.md)"
