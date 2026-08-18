#!/usr/bin/env bash
# Creates a scratch git repo and registers it as a bb project on YOUR dev instance.
# usage: BB_REPO=/path/to/bb 01-setup-project.sh <host id from `bbdev.sh machine list`>
# The server URL is always derived from `scripts/bb-dev-app env` in $BB_REPO (or the git
# toplevel of the cwd); an inherited BB_SERVER_URL is ignored on purpose (bb-spawned shells
# point at the packaged :38886 instance, which this repro must never touch).
set -euo pipefail
REPO="${BB_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "$REPO" && -x "$REPO/scripts/bb-dev-app" ]] || { echo "set BB_REPO=/path/to/bb worktree" >&2; exit 1; }
eval "$("$REPO/scripts/bb-dev-app" env)"
HOST_ID="${1:?host id (bbdev.sh machine list)}"
REPO_DIR=/tmp/bb-1717-qa-repo
rm -rf "$REPO_DIR"; mkdir -p "$REPO_DIR"; cd "$REPO_DIR"
git init -q -b main
echo "# qa" > README.md
git add . && git -c user.email=qa@example.com -c user.name=qa commit -qm init
echo "server: $BB_SERVER_URL" >&2
curl -s -X POST "$BB_SERVER_URL/api/v1/projects" -H 'content-type: application/json' \
  -d "{\"name\":\"qa-1717\",\"source\":{\"type\":\"local_path\",\"path\":\"$REPO_DIR\",\"hostId\":\"$HOST_ID\"}}"
echo
