#!/usr/bin/env bash
# Spawns a thread on the dev instance whose prompt contains a ```sh fence and a ```python fence.
set -euo pipefail
export BB_SERVER_URL=http://localhost:20645 BB_HOST_DAEMON_PORT=28645 BB_PROJECT_ID=proj_hbmk4b4bdz
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-32
node packages/scripts/dist/commands/run-cli.js thread spawn --json \
  --project proj_hbmk4b4bdz --environment /tmp/bb-1751-repo --machine host_ps4ndpugw3 \
  --provider claude-code --permission-mode full --title "issue-1751 shell fence" \
  --prompt "$(cat /tmp/bb-reports/issues/1751/repro/prompt.md)"
