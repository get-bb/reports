#!/usr/bin/env bash
# Saves the raw thread event streams for the given thread ids next to this script.
# usage: BB_REPO=/path/to/bb 03-collect-evidence.sh thr_a thr_b ...
# Server URL is always derived from `scripts/bb-dev-app env` in $BB_REPO (inherited
# BB_SERVER_URL is ignored on purpose, see bbdev.sh).
set -euo pipefail
REPO="${BB_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "$REPO" && -x "$REPO/scripts/bb-dev-app" ]] || { echo "set BB_REPO=/path/to/bb worktree" >&2; exit 1; }
eval "$("$REPO/scripts/bb-dev-app" env)"
cd "$(dirname "$0")"
for t in "$@"; do
  curl -s "$BB_SERVER_URL/api/v1/threads/$t/events" > "events-$t.json"
  echo "saved events-$t.json ($(wc -c < "events-$t.json") bytes)"
done
