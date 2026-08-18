#!/usr/bin/env bash
# Verifier's CLI wrapper: ALWAYS targets the verifier's own dev instance.
set -euo pipefail
BB_REPO="/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-6"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_CLI
export BB_SERVER_URL="http://localhost:20041" BB_HOST_DAEMON_PORT=28041 BB_PROJECT_ID=proj_personal
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
