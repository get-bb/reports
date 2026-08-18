#!/bin/bash
# CLI wrapper for the dev instance of a bb worktree.
# Usage: BB_REPO=/abs/path/to/bb/worktree ./1710-bb.sh <bb args...>
set -e
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
