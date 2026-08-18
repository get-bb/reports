#!/bin/bash
# $1 = output label
cd /tmp/bb-reports/issues/1773/repro
export BB_WORKTREE=/home/sawyer/projects/bb/.claude/worktrees/wf_6b6686dc-4c2-35 BB_SERVER_URL=http://localhost:25786 BB_HOST_DAEMON_PORT=33786 THREAD_ID=thr_eic8xpsxa2
./run-thread-open.sh > /tmp/bb-reports/issues/1773/verify/rev-thread-open-$1.txt 2>&1 &
dev-browser --browser bb1773v2 --headless --timeout 120 run browser-reload-and-watch-fast.js > /tmp/bb-reports/issues/1773/verify/rev-watch-C-$1.txt 2>&1
wait
echo "--- thread open output:"; tail -5 /tmp/bb-reports/issues/1773/verify/rev-thread-open-$1.txt
echo "--- browser:"; cat /tmp/bb-reports/issues/1773/verify/rev-watch-C-$1.txt
