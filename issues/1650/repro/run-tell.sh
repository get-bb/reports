#!/bin/bash
# Live repro helper. Run from the bb worktree root: ./run-tell.sh <thread id>
# Requires a running dev instance (scripts/bb-dev-app current) and the env from
# `scripts/bb-dev-app env` (adjust the ports below to your instance).
export BB_SERVER_URL=http://localhost:21503
export BB_HOST_DAEMON_PORT=29503
export BB_PROJECT_ID=proj_dd42ck6esj
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
T=$1
run() { echo "\$ $*"; "$@" 2>&1 | grep -v '^>'; echo "exit=${PIPESTATUS[0]}"; echo; }
run pnpm bb:dev thread interactions list "$T"
run pnpm bb:dev thread tell "$T" "worker report 1: task done"
run pnpm bb:dev thread tell "$T" "worker report 2" --mode queue
run pnpm bb:dev thread tell "$T" "worker report 3" --mode auto
run pnpm bb:dev thread queue list "$T"
