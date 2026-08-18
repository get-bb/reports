#!/bin/bash
export BB_SERVER_URL=http://localhost:19440
export BB_HOST_DAEMON_PORT=27440
export BB_PROJECT_ID=proj_personal
exec node /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-9/packages/scripts/dist/commands/run-cli.js "$@"
