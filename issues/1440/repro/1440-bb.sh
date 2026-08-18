#!/usr/bin/env bash
# Wrapper: run the bb CLI against the dev instance of $BB_REPO.
set -euo pipefail
: "${BB_REPO:?set BB_REPO to your bb worktree root}"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
