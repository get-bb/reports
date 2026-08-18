#!/bin/bash
export BB_SERVER_URL=http://localhost:21284 BB_HOST_DAEMON_PORT=29284
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID
cd /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-15
for t in "$@"; do
  echo "== $t"
  node packages/scripts/dist/commands/run-cli.js thread show $t 2>&1 | sed -n 1,3p
  echo "-- bb thread log $t:"
  node packages/scripts/dist/commands/run-cli.js thread log $t 2>&1
  echo "-- GET /api/v1/threads/$t/timeline:"
  curl -s "http://localhost:21284/api/v1/threads/$t/timeline" | head -c 600
  echo
  echo "-- events rows in sqlite:"
  sqlite3 /home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-15-5fbafe2ca7f4/bb.db "SELECT sequence, type FROM events WHERE thread_id='$t' ORDER BY sequence;"
done
