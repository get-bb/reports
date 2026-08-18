#!/usr/bin/env bash
# usage: run-cli.sh <bb-app version|worktree> <server port> [extra args...]
set -u
unset BB_CLI
ver="$1"; port="$2"; shift 2
export BB_SERVER_URL="http://localhost:${port}"
if [ "$ver" = "worktree" ]; then
  node /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-50/packages/scripts/dist/commands/run-cli.js "$@"
else
  npx --yes -p "bb-app@${ver}" bb "$@"
fi
echo "exit=$?"
