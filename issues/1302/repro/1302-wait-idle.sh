#!/usr/bin/env bash
# Wait until every given thread id reports status idle (or error).
# Usage: 1302-wait-idle.sh <thread id>...
# Targets YOUR dev instance (scripts/bb-dev-app env of $BB_REPO); an inherited
# BB_SERVER_URL is ignored. Override only via BB_DEV_SERVER_URL.
set -euo pipefail
BB_REPO="${BB_REPO:-/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-24}"
override="${BB_DEV_SERVER_URL:-}"
unset BB_SERVER_URL
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
if [ -n "$override" ]; then BB_SERVER_URL="$override"; fi
for id in "$@"; do
  until curl -s "$BB_SERVER_URL/api/v1/threads/$id" | jq -e '.status=="idle" or .status=="error"' >/dev/null; do sleep 1; done
  echo "$id $(curl -s "$BB_SERVER_URL/api/v1/threads/$id" | jq -r .status)"
done
