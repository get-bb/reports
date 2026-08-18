#!/bin/bash
# Run `bb thread open <thread> README.md` against YOUR dev instance once the
# browser script has written its ready marker. Set these for your instance:
#   BB_WORKTREE  - your bb worktree (default: cwd)
#   BB_SERVER_URL / BB_HOST_DAEMON_PORT - from `scripts/bb-dev-app env`
#   THREAD_ID    - the thread shown in the browser
# Example: BB_SERVER_URL=http://localhost:25786 BB_HOST_DAEMON_PORT=33786 THREAD_ID=thr_x ./run-thread-open.sh
cd "${BB_WORKTREE:-$PWD}" || exit 1
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
: "${BB_SERVER_URL:?set BB_SERVER_URL}" "${BB_HOST_DAEMON_PORT:?set BB_HOST_DAEMON_PORT}" "${THREAD_ID:?set THREAD_ID}"
export BB_SERVER_URL BB_HOST_DAEMON_PORT
READY="$HOME/.dev-browser/tmp/1773-ready"
rm -f "$READY"
until [ -f "$READY" ]; do sleep 0.5; done
exec pnpm bb:dev thread open "$THREAD_ID" README.md --json
