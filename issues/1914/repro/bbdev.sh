#!/usr/bin/env bash
# Runs the bb CLI against the investigation's own dev instance.
export BB_SERVER_URL=http://localhost:19386
export BB_HOST_DAEMON_PORT=27386
export BB_PROJECT_ID="${BB_PROJECT_ID:-proj_personal}"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-6
exec node packages/scripts/dist/commands/run-cli.js "$@"
