#!/usr/bin/env bash
# Spawns a codex thread on the dev instance that echoes the issue body back verbatim.
set -euo pipefail
export BB_SERVER_URL=http://localhost:26548 BB_HOST_DAEMON_PORT=34548
PROMPT="$(cat /tmp/bb-reports/issues/1778/repro/prompt.txt)"
cd /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-14
node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_x3nfvqf5v4 --provider codex --permission-mode accept-edits --title "issue 1778 math repro" --prompt "$PROMPT" --json
