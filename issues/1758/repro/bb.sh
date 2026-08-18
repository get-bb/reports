#!/usr/bin/env bash
# `bb` CLI pointed at the repro dev instance (ports derived from the worktree path).
export BB_SERVER_URL=http://localhost:23580
export BB_HOST_DAEMON_PORT=31580
export BB_PROJECT_ID=proj_personal
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
export PATH=/tmp/bb-reports/issues/1758/repro/fakebin:$PATH
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-3
exec node packages/scripts/dist/commands/run-cli.js "$@"
