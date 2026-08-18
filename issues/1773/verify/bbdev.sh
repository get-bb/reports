#!/bin/bash
# helper: run bb CLI against my own dev instance
cd /home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-35 || exit 1
export BB_SERVER_URL=http://localhost:25786 BB_HOST_DAEMON_PORT=33786
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
exec pnpm bb:dev "$@"
