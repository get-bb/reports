#!/usr/bin/env bash
# Sends a follow-up turn to a thread and, while cursor-agent is working,
# captures the BB_ACP_DYNAMIC_TOOLS env of the bb-bridge MCP server process
# that bb spawns for that session (proves which tool schemas Cursor received).
# usage: BB_SERVER_URL=... catch-mcp-env.sh <thread-id> <out-file>
#   BB_CLI_JS may point at run-cli.js; default: <repo root>/packages/scripts/dist/commands/run-cli.js
#   where <repo root> is $BB_REPO or the git toplevel of the current directory.
set -u
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_CLI
thread="$1"; out="$2"
repo=${BB_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
CLI=${BB_CLI_JS:-$repo/packages/scripts/dist/commands/run-cli.js}
[ -f "$CLI" ] || { echo "run-cli.js not found at $CLI (set BB_CLI_JS or run from inside the bb repo)"; exit 2; }
node "$CLI" thread tell "$thread" "Reply only with ok." 2>&1 | tail -1
for i in $(seq 1 120); do
  f=$(grep -l "BB_ACP_DYNAMIC_TOOLS" /proc/[0-9]*/environ 2>/dev/null | head -1)
  if [ -n "$f" ]; then
    echo "found $f"
    tr '\0' '\n' < "$f" | grep -E "^BB_ACP_DYNAMIC_TOOLS=" > "$out"
    wc -c "$out"
    exit 0
  fi
  sleep 0.5
done
echo "no MCP server process observed"
exit 1
