#!/usr/bin/env bash
# Instance ONE: data dir /tmp/bb1558-one, ports 45886 (server) / 45887 (daemon)
set -u
BBAPP=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-21/packages/bb-app/dist/bb-app.js
rm -rf /tmp/bb1558-one; mkdir -p /tmp/bb1558-one
cd /tmp
BB_DATA_DIR=/tmp/bb1558-one BB_SERVER_PORT=45886 BB_HOST_DAEMON_PORT=45887 \
  nohup node "$BBAPP" > /tmp/bb1558-one/launcher.log 2>&1 &
echo "one pid=$!"
