#!/usr/bin/env bash
# Thin `bb` wrapper aimed at YOUR dev instance.
# Usage: BB_REPO=/abs/path/to/bb/worktree ./1770-bb.sh <bb args...>
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
export BB_SERVER_URL BB_HOST_DAEMON_PORT
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
