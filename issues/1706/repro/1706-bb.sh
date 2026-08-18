#!/bin/bash
# CLI wrapper for the bb dev instance of a worktree.
# Usage: BB_REPO=<bb worktree root> 1706-bb.sh <bb args…>
# It reads BB_SERVER_URL etc. from `scripts/bb-dev-app env` of that worktree and
# runs the built CLI (packages/scripts/dist/commands/run-cli.js).
set -e
BB_REPO="${BB_REPO:?set BB_REPO to your bb worktree root (must contain scripts/bb-dev-app)}"
[ -x "$BB_REPO/scripts/bb-dev-app" ] || { echo "no scripts/bb-dev-app under $BB_REPO" >&2; exit 2; }
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
