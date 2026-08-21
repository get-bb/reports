#!/usr/bin/env bash
# Usage: tell-file.sh <thread-id> <model> <file-with-message>
# Sends the file's content as a new turn on the thread with the given model.
# Run it from your bb worktree after `eval "$(scripts/bb-dev-app env)"` so that
# BB_SERVER_URL / BB_HOST_DAEMON_PORT point at YOUR dev instance. Nothing is hardcoded.
set -euo pipefail
THREAD="$1"; MODEL="$2"; FILE="$3"
: "${BB_SERVER_URL:?set BB_SERVER_URL first: eval \"\$(scripts/bb-dev-app env)\"}"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
MSG="$(cat "$FILE")"
pnpm bb:dev thread tell "$THREAD" --model "$MODEL" --mode auto --json "$MSG" 2>&1 | tail -5
