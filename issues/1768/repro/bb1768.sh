#!/usr/bin/env bash
# `bb` wrapper for this repro: clears inherited thread-scoped env vars and
# points the dev CLI at the dev instance. Edit the three variables to match
# your worktree / `scripts/bb-dev-app current` output.
#   bash bb1768.sh thread list --project proj_xxx
REPO="${REPO_1768:-/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-32}"
export BB_SERVER_URL="${BB_SERVER_URL_1768:-http://localhost:20608}"
export BB_HOST_DAEMON_PORT="${BB_HOST_DAEMON_PORT_1768:-28608}"
unset BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_CLI
# BB_THREAD_ID is kept only when the caller set PARENT (for --parent-self).
if [ -n "${PARENT:-}" ]; then export BB_THREAD_ID="$PARENT"; else unset BB_THREAD_ID; fi
exec node "$REPO/packages/scripts/dist/commands/run-cli.js" "$@"
