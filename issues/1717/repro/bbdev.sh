#!/usr/bin/env bash
# Runs the bb CLI against YOUR dev instance (the one started with `scripts/bb-dev-app current`).
# Point it at your bb worktree with BB_REPO=/path/to/bb (or run it from inside that worktree).
# It ALWAYS re-derives BB_SERVER_URL / BB_HOST_DAEMON_PORT from `scripts/bb-dev-app env` in
# that repo, deliberately ignoring any inherited BB_SERVER_URL: shells spawned by bb itself
# carry the packaged instance's URL (:38886) and this repro must never touch that instance.
set -euo pipefail
REPO="${BB_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "$REPO" && -x "$REPO/scripts/bb-dev-app" ]] || { echo "set BB_REPO=/path/to/bb worktree (or run from inside it)" >&2; exit 1; }
eval "$("$REPO/scripts/bb-dev-app" env)"
export BB_SERVER_URL BB_HOST_DAEMON_PORT BB_PROJECT_ID
cd "$REPO" || exit 1
exec node packages/scripts/dist/commands/run-cli.js "$@"
