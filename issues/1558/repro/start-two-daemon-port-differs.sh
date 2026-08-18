#!/usr/bin/env bash
# Variant: instance TWO with a different data dir AND a different daemon port,
# but the SAME server port as instance one. Shows the launcher reporting
# "bb is ready" and then looping "Server restarted" while its own server child
# dies with EADDRINUSE every time.
set -u
BBAPP=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-21/packages/bb-app/dist/bb-app.js
rm -rf /tmp/bb1558-two; mkdir -p /tmp/bb1558-two
cd /tmp
BB_DATA_DIR=/tmp/bb1558-two BB_SERVER_PORT=45886 BB_HOST_DAEMON_PORT=45889 \
  nohup node "$BBAPP" > /tmp/bb1558-two/launcher-variant.log 2>&1 &
echo "two pid=$!"
