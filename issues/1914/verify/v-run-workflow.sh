#!/usr/bin/env bash
set -euo pipefail
export BB_SERVER_URL=http://localhost:22974
export BB_HOST_DAEMON_PORT=30974
export BB_PROJECT_ID=proj_w63jk3ybmq
export BB_THREAD_ID=thr_pju6b4e723
export BB_ENVIRONMENT_ID=env_5sn6kb3cbx
cd /tmp/bb-1914-verify/qa-repo
CLI=/home/sawyer/projects/bb/.claude/worktrees/wf_d5c47f31-487-12/packages/scripts/dist/commands/run-cli.js
exec node "$CLI" workflows "$@"
