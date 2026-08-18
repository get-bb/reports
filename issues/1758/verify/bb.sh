#!/usr/bin/env bash
# verifier's CLI wrapper (own worktree, own ports)
export BB_SERVER_URL=http://localhost:23569
export BB_HOST_DAEMON_PORT=31569
export BB_PROJECT_ID=proj_personal
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
export PATH=/tmp/bb-reports/issues/1758/verify/fakebin:$PATH
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-58
exec node packages/scripts/dist/commands/run-cli.js "$@"
