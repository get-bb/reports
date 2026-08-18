#!/bin/bash
# `bb` CLI wrapper pointed at YOUR dev instance.
# Usage: BB_REPO=/abs/path/to/bb/worktree /tmp/bb-reports/issues/1646/repro/1646-bb.sh thread list --json
set -euo pipefail
BB_REPO="${BB_REPO:-/home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-10}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
export BB_SERVER_URL BB_HOST_DAEMON_PORT
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
