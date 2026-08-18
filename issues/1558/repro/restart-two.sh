#!/usr/bin/env bash
# Instance TWO again, keeping its data dir (and the mis-enrolled auth.json)
set -u
BBAPP=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-21/packages/bb-app/dist/bb-app.js
cd /tmp
BB_DATA_DIR=/tmp/bb1558-two BB_SERVER_PORT=45886 BB_HOST_DAEMON_PORT=45887 \
  nohup node "$BBAPP" > /tmp/bb1558-two/launcher-restart.log 2>&1 &
echo "two pid=$!"
