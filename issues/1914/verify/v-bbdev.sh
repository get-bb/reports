#!/usr/bin/env bash
export BB_SERVER_URL=http://localhost:22974
export BB_HOST_DAEMON_PORT=30974
export BB_PROJECT_ID="${BB_PROJECT_ID:-proj_personal}"
cd /home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-12
exec node packages/scripts/dist/commands/run-cli.js "$@"
