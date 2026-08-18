#!/usr/bin/env bash
# CLI wrapper for YOUR dev instance. Set BB_REPO to your bb worktree root.
#
# It ALWAYS derives BB_SERVER_URL / BB_HOST_DAEMON_PORT from
# `scripts/bb-dev-app env` of that worktree and first drops any inherited
# BB_* variables. Shells opened from inside a bb agent thread already export
# BB_SERVER_URL (pointing at the user's real instance, e.g. :38886); an
# earlier version of this wrapper honoured that and silently talked to the
# wrong server. Override the target only via BB_DEV_SERVER_URL.
set -euo pipefail
BB_REPO="${BB_REPO:-/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-24}"
override="${BB_DEV_SERVER_URL:-}"
for v in $(compgen -e | grep '^BB_' | grep -v '^BB_REPO$' || true); do unset "$v"; done
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
if [ -n "$override" ]; then BB_SERVER_URL="$override"; fi
export BB_SERVER_URL BB_PROJECT_ID=proj_personal
echo "bb -> $BB_SERVER_URL" >&2
exec node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" "$@"
