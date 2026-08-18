#!/usr/bin/env bash
# Wrapper: run a bb CLI command against YOUR OWN dev instance.
# Requires BB_SERVER_URL to be set (and, ideally, BB_HOST_DAEMON_PORT), e.g.
#   eval "$(scripts/bb-dev-app env)"   # from your bb worktree, after `scripts/bb-dev-app current`
# BB_WORKTREE must point at a built bb checkout (defaults to $PWD).
set -euo pipefail
: "${BB_SERVER_URL:?set BB_SERVER_URL (eval \"\$(scripts/bb-dev-app env)\" from your bb worktree)}"
export BB_SERVER_URL
export BB_PROJECT_ID="${BB_PROJECT_ID:-proj_personal}"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE
cd "${BB_WORKTREE:-$PWD}"
exec node packages/scripts/dist/commands/run-cli.js "$@"
