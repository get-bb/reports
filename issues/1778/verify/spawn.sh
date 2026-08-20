#!/usr/bin/env bash
# Verifier: spawns a codex thread on the verifier's dev instance that echoes the issue body back verbatim.
set -euo pipefail
export BB_SERVER_URL=http://localhost:26426 BB_HOST_DAEMON_PORT=34426
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_PROJECT_ID BB_THREAD_STORAGE
PROMPT="$(cat /tmp/bb-reports/issues/1778/repro/prompt.txt)"
cd /home/sawyer/projects/bb/.claude/worktrees/wf_926b3193-f6c-19
node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_d6ckfmpcvw --provider codex --permission-mode accept-edits --title "issue 1778 verify" --prompt "$PROMPT" --json
