#!/usr/bin/env bash
# bb CLI wrapper targeting YOUR dev instance.
# Usage: BB_REPO=/abs/path/to/bb/worktree 1718-bb.sh <bb args>
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
